/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/mytimesheet/util/CommonModelManager",
	"sap/m/Button",
	"sap/m/Dialog",
	"sap/m/GroupHeaderListItem",
	"sap/m/List",
	"sap/m/ListMode",
	"sap/m/MessageToast",
	"sap/m/ObjectAttribute",
	"sap/m/ObjectListItem",
	"sap/m/ObjectStatus",
	"sap/ui/core/Control",
	"sap/ui/core/EventBus",
	"sap/ui/Device",
	"sap/ui/model/Filter",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Sorter"
], function(CommonModelManager, Button, Dialog, GroupHeaderListItem, List, ListMode, MessageToast, ObjectAttribute, ObjectListItem,
	ObjectStatus, Control, EventBus, Device, Filter, JSONModel, Sorter) {
	"use strict";

	var ConcurrentEmploymentButtonBase = {
		metadata: {
			library: "hcm.fab.mytimesheet",
			properties: {
				enabled: {
					type: "boolean",
					defaultValue: true
				},
				applicationId: {
					type: "string"
				},
				assignmentId: {
					type: "string"
				},
				showManagersOnly: {
					type: "boolean"
				}
			},
			events: {
				assignmentChange: {
					parameters: {
						selectedAssignment: {
							type: "string"
						}
					}
				},
				assignmentsLoaded: {
					parameters: {
						numberOfAssignments: {
							type: "int"
						},
						defaultAssignment: {
							type: "string"
						},
						hasConcurrentEmployments: {
							type: "boolean"
						}
					}
				}
			}
		},

		initBase: function() {
			// initialize global variables
			this._oDialog = null;
			this._bHasDataVisible = false; // Visibility according to number of assignments (>1 = visible)
			this._bStateVisible = false; // Visibility to state (CE active according to current assignment)
			this._bManualVisible = true; // Visibility set externally by control consumer
			this._queuedReadRequest = null;
			this._bDataRead = false;
			this._bOnBehalfActive = false;
			this._oEventBus = null;

			// initialize model
			this._oAssignmentModel = new JSONModel({
				selectedAssignmentId: null,
				assignmentList: [],
				showEmployeeNumberWithoutZeros: false
			});
			this.setModel(CommonModelManager.getModel(), "commonModel");

			// initialize language file
			this.oResourceBundle = CommonModelManager.getI18NModel().getResourceBundle();

			this._updateVisibleInternal();
			this.setIcon("sap-icon://citizen-connect");
			this.setText(this.oResourceBundle.getText("ceButtonText"));
			this.setTooltip(this.oResourceBundle.getText("ceButtonTooltip"));
			this.attachPress(this.onCeButtonPressed.bind(this));
		},
		
		exitBase: function() {
			// deregister from event bus
			if(this._oEventBus) {
				this._oEventBus.unsubscribe("hcm.fab.mytimesheet", "assignmentChanged", this._handleAssignmentChangedEvent, this);
				this._oEventBus = null;
			}
		},
		
		_registerEventBus: function(applicationId) {
			if(!this._oEventBus) {
				// register for events
				this._oEventBus = CommonModelManager.getEventBus();
				this._oEventBus.subscribe("hcm.fab.mytimesheet", "assignmentChanged", this._handleAssignmentChangedEvent, this);
				
				// set correct current application state
				this._handleAssignmentChangedEvent("hcm.fab.mytimesheet", "assignmentChanged", {
					applicationId: applicationId,
					assignmentId: CommonModelManager.getSelectedAssignment(applicationId),
					onBehalfEmployeeId: CommonModelManager.getSelectedOnBehalfEmployeeId(applicationId)
				});
			}
		},
		
		_unregisterEventBus: function() {
			if(this._oEventBus) {
				this._oEventBus.unsubscribe("hcm.fab.mytimesheet", "assignmentChanged", this._handleAssignmentChangedEvent, this);
				this._oEventBus = null;
			}
		},
		
		_handleAssignmentChangedEvent: function(sChannelId, sEventId, oData) {
			if(!(sChannelId === "hcm.fab.mytimesheet" && sEventId === "assignmentChanged" && oData.applicationId === this.getApplicationId())) {
				return;
			}
			
			this.setAssignmentId(oData.assignmentId, oData.applicationId);
			
			// onbehalf event? update visibility change
//			if(oData.onBehalfEmployeeId) {
			this._bOnBehalfActive = oData.onBehalfEmployeeId;
			this._updateVisibleInternal();
//				var applicationId = oData.applicationId;
//				CommonModelManager.getOnBehalfEmployeeInformation(oData.assignmentId, oData.onBehalfEmployeeId, applicationId).then(this._updateVisibilityForAssignmentInformation.bind(this));
//			}
		},
		
		_formatEmployeeNumber: function (sEmployeeNumber, bShowEmployeeNumberWithoutZeros) {
			if (bShowEmployeeNumberWithoutZeros) {
				return parseInt(sEmployeeNumber, 10);
			} else {
				return sEmployeeNumber;
			}
		},

		// handler for click on CE button
		onCeButtonPressed: function() {
			if (!this._oDialog) {
				// create the CE dialog (including a list with the assignments)
				var objectListItemConfig = {
					title: "{AssignmentText}",
					icon: "sap-icon://employee",
					selected: {
						formatter: function(selectedAssignmentId, itemAssignmentId) {
							return selectedAssignmentId === itemAssignmentId;
						},
						parts: ["/selectedAssignmentId", "EmployeeId"]
					},
					attributes: [
						new ObjectAttribute({
							title: this.oResourceBundle.getText("employeeNumberLabel"),
							text: {
								formatter: this._formatEmployeeNumber,
								parts: ["EmployeeId", "/showEmployeeNumberWithoutZeros"]
							}
						})
					]
				};
				var objectListStatus = new ObjectStatus({
					text: "{EmploymentStatusText}",
					state: {
						formatter: function(status) {
							switch (status) {
								case "0":
									return sap.ui.core.ValueState.Error;
								case "1":
								case "2":
									return sap.ui.core.ValueState.Warning;
								case "3":
									return sap.ui.core.ValueState.Success;
								default:
									return sap.ui.core.ValueState.None;
							}
						},
						parts: ["EmploymentStatus"]
					}
				});
				if (Device.system.desktop) {
					objectListItemConfig.firstStatus = objectListStatus;
				} else {
					objectListItemConfig.secondStatus = objectListStatus;
				}
				var itemTemplate = new ObjectListItem(objectListItemConfig);

				var oList = new List({
					items: {
						path: "/assignmentList",
						templateShareable: false,
						template: itemTemplate,
						sorter: new Sorter("IsDefaultAssignment", true, true),
						groupHeaderFactory: this._getGroupHeaderFactory.bind(this)
					},
					selectionChange: this._onPernrSelected.bind(this),
					mode: ListMode.SingleSelectMaster
				});
				this._oDialog = new Dialog({
					title: this.oResourceBundle.getText("assignmentSelectionDialogTitle"),
					stretch: Device.system.phone,
					content: oList,
					contentWidth: !Device.system.phone ? "30rem" : undefined,
					beginButton: new Button({
						text: this.oResourceBundle.getText("cancelButtonText"),
						tooltip: this.oResourceBundle.getText("cancelButtonTooltip"),
						press: function() {
							this._oDialog.close();
						}.bind(this)
					})
				});
				this._oDialog.setModel(this._oAssignmentModel);
				this.addDependent(this._oDialog);
			}
			this._oDialog.open();
		},

		// handler for item click in the assignment list (new assignment was selected)
		_onPernrSelected: function(oEvent) {
			// CE dialog was closed
			// check if PERNR was changed
			var oItem = oEvent.getParameter("listItem");
			var selectedPernr = oItem.getBindingContext().getProperty("EmployeeId");
			var currentPernr = this.getProperty("assignmentId");
			if (currentPernr !== selectedPernr) {
				this.setAssignmentId(selectedPernr);
				
				// store selected assignment for later reuse after cross app navigation
				if(this.getApplicationId()) {
					CommonModelManager.setSelectedAssignment(selectedPernr, this.getApplicationId());
				} else {
					CommonModelManager.setSelectedAssignment(selectedPernr); // legacy call, without application id
				}
				
				this._oDialog.close();
				
				// raise event for application
				this.fireEvent("assignmentChange", {
					selectedAssignment: selectedPernr
				});
				
				MessageToast.show(this.oResourceBundle.getText("assignmentSwitchText", selectedPernr));
			}
		},

		// grouping function for assignment list (group by 'Default Assignment' and 'Other Assignments')
		_getGroupHeaderFactory: function(oGroup) {
			return new GroupHeaderListItem({
				title: oGroup.key ? this.oResourceBundle.getText("defaultAssignmentGroupTitle") : this.oResourceBundle.getText(
					"otherAssignmentsGroupTitle"),
				upperCase: false
			});
		},
		
		_queueReadRequest: function() {
			this._bDataRead = true;
			if (this._queuedReadRequest) {
				jQuery.sap.clearDelayedCall(this._queuedReadRequest);
			}
			this._queuedReadRequest = jQuery.sap.delayedCall(0, this, "_readAssignmentData");
		},
		
		_readAssignmentData: function() {
			// read assigments and default assignment
			var applicationId = this.getProperty("applicationId");
			Promise.all([
				CommonModelManager.getAssignmentList(applicationId),
				CommonModelManager.getDefaultAssignment(applicationId)
			]).then(function(oResults) {
				var oData = oResults[0];
				var oDefaultAssignment = oResults[1];
				
				// managers only?
				if (this.getShowManagersOnly()) {
					oData = oData.filter(function (oAssignment) {
						return oAssignment.IsManager;
					});
				}
				
				this._oAssignmentModel.setProperty("/assignmentList", oData);

				// Select default assignment, if assignment is empty (not set externally) and applicationID is not set (legacy mode)
				var currentAssignmentId = this.getProperty("assignmentId");
				if (!currentAssignmentId && oDefaultAssignment && !applicationId) {
					this.setAssignmentId(oDefaultAssignment.EmployeeId);
				}

				if (oData.length > 1) {
					// multiple assignments exist -> make the CE button visible
					this._bHasDataVisible = true;
					this._updateVisibleInternal();
				}
				this.fireEvent("assignmentsLoaded", {
					numberOfAssignments: oData.length,
					defaultAssignment: this.getProperty("assignmentId"),
					hasConcurrentEmployments: oData.length > 1
				});
			}.bind(this), function() {
				this._bHasDataVisible = false;
				this._updateVisibleInternal();
			}.bind(this));
		},

		// initialize the CE assignment data (ODATA backend call)
		onBeforeRendering: function() {
			if(!this._bDataRead) { // only request data, if it was not requested before (because of individual property setters)
				this._queueReadRequest();
			}
		},

		_updateVisibleInternal: function() {
			this.setProperty("visible", !!this._bManualVisible && this._bHasDataVisible && this._bStateVisible && !this._bOnBehalfActive);
		},
		
		setAssignmentId: function(assignmentId) {
			if(!assignmentId || this.getAssignmentId() === assignmentId) {
				return;
			}
			
			this.setProperty("assignmentId", assignmentId);
			
			// only accept this assignment if the pernr belongs to on of the CE assignments
			jQuery.sap.delayedCall(0, this, function() {
				var applicationId = this.getApplicationId();
				CommonModelManager.isConcurrentEmploymentAssignment(assignmentId, applicationId).then(function(isCE) {
					if(!isCE) {
						return;
					}
					this._oAssignmentModel.setProperty("/selectedAssignmentId", assignmentId);
					CommonModelManager.getAssignmentInformation(assignmentId, applicationId).then(function(oAssignment) {
						if(oAssignment) {
							if(oAssignment.hasOwnProperty("IsCeButtonEnabled")) {
								this._bStateVisible = oAssignment.IsCeButtonEnabled;
							} else {
								this._bStateVisible = true; // no customizing property in backend, always visible
							}
							this._oAssignmentModel.setProperty("/showEmployeeNumberWithoutZeros", oAssignment.ShowEmployeeNumberWithoutZeros);
							this._updateVisibleInternal();
						}
					}.bind(this));
				}.bind(this));
			}.bind(this));
		},
		
		setApplicationId: function(applicationId) {
			if(!applicationId) {
				return;
			}
			
			this.setProperty("applicationId", applicationId);
			this._queueReadRequest();
			
			// new API, register event bus
			this._registerEventBus(applicationId);
		},

		setVisible: function(visible) {
			this._bManualVisible = visible;
			this._updateVisibleInternal();
		}
	};

	return ConcurrentEmploymentButtonBase;
});