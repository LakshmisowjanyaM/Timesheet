/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/mytimesheet/util/CommonModelManager",
	"sap/m/Button",
	"sap/m/ButtonType",
	"sap/m/Dialog",
	"sap/m/GroupHeaderListItem",
	"sap/m/List",
	"sap/m/ListMode",
	"sap/m/MessageToast",
	"sap/m/ObjectAttribute",
	"sap/m/ObjectListItem",
	"sap/m/ObjectStatus",
	"sap/m/Toolbar",
	"sap/m/SearchField",
	"sap/m/VBox",
	"sap/ui/core/Control",
	"sap/ui/core/EventBus",
	"sap/ui/Device",
	"sap/ui/model/Filter",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Sorter"
], function (CommonModelManager, Button, ButtonType, Dialog, GroupHeaderListItem, List, ListMode, MessageToast, ObjectAttribute,
	ObjectListItem, ObjectStatus, Toolbar, SearchField, VBox, Control, EventBus, Device, Filter, JSONModel, Sorter) {
	"use strict";

	var OnBehalfButtonBase = {
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
				onBehalfEmployeeId: {
					type: "string"
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
				employeesLoaded: {
					parameters: {
						numberOfEmployees: {
							type: "int"
						},
						hasOnBehalfEmployees: {
							type: "boolean"
						}
					}
				}
			}
		},

		initBase: function () {
			// initialize global variables
			this._oDialog = null;
			this._oEmployeeList = null;
			this._oSearchField = null;
			this._bHasDataVisible = false; // Visibility according to number of assignments (>1 = visible)
			this._bStateVisible = true; // Visibility to state (on behalf deactivated or active and master app?)
			this._bManualVisible = true; // Visibility set externally by control consumer
			this._sAssignmentId = null; // Real (CE) assignment used for reading on-behalf list (might be different to assignment property if a non-CE pernr is bound)
			this._bShowEmployeePicture = null; // indicates if dialog currently shows the employee picture or not
			this._bShowEmployeeNumber = null; // indicates if dialog currently shows the employee number or not
			this._queuedReadRequest = null;
			this._oEventBus = null;

			// initialize model
			this._oLocalModel = new JSONModel({
				onBehalfEmployeeList: [],
				showEmployeeNumberWithoutZeros: false
			});
			this.setModel(CommonModelManager.getModel(), "commonModel");

			// initialize language file
			this.oResourceBundle = CommonModelManager.getI18NModel().getResourceBundle();

			this._updateVisibleInternal();
			this._updateButton(false);
			this.attachPress(this.onOnBehalfButtonPressed.bind(this));
		},

		exitBase: function () {
			// deregister from event bus
			if (this._oEventBus) {
				this._oEventBus.unsubscribe("hcm.fab.mytimesheet", "assignmentChanged", this._handleAssignmentChangedEvent, this);
				this._oEventBus = null;
			}
		},

		_registerEventBus: function (applicationId) {
			if (!this._oEventBus) {
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

		_unregisterEventBus: function () {
			if (this._oEventBus) {
				this._oEventBus.unsubscribe("hcm.fab.mytimesheet", "assignmentChanged", this._handleAssignmentChangedEvent, this);
				this._oEventBus = null;
			}
		},

		_handleAssignmentChangedEvent: function (sChannelId, sEventId, oData) {
			if (!(sChannelId === "hcm.fab.mytimesheet" && sEventId === "assignmentChanged" && oData.applicationId === this.getApplicationId())) {
				return;
			}

			// assignment or onbehalf employee changed?
			this.setAssignmentId(oData.assignmentId);
			this.setOnBehalfEmployeeId(oData.onBehalfEmployeeId);
		},

		_formatEmployeePictureUrl: function (oEmployeePicture) {
			if (oEmployeePicture) {
				return oEmployeePicture.__metadata.media_src.replace(/(\w+\:\/\/)?[^\/]+/, "");
			}
			return undefined;
		},
		
		_formatEmployeeNumber: function (sEmployeeNumber, bShowEmployeeNumberWithoutZeros) {
			if (bShowEmployeeNumberWithoutZeros) {
				return parseInt(sEmployeeNumber, 10);
			} else {
				return sEmployeeNumber;
			}
		},

		// handler for click on on behalf button
		onOnBehalfButtonPressed: function () {
			if (this.getProperty("onBehalfEmployeeId")) {
				// on behalf is active, disable it
				CommonModelManager.setActivatedOnBehalf(this.getApplicationId(), false); // also revert that the application activated onbehalf
				CommonModelManager.setOnBehalfEmployeeId(this._sAssignmentId, null, this.getApplicationId());
				this.setOnBehalfEmployeeId(null);
				this.fireEvent("assignmentChange", {
					selectedAssignment: this._sAssignmentId
				});
			} else {
				// not active, show employee list
				// fetch settings of for current assignment (CE or OB) for employee photo and number
				var applicationId = this.getApplicationId();
				var pernr = this.getOnBehalfEmployeeId() || this.getAssignmentId();
				CommonModelManager.getAssignmentInformation(pernr, applicationId).then(function (oAssignment) {

					// employee photo or number setting changed?
					if (oAssignment.ShowEmployeePicture !== this._bShowEmployeePicture || oAssignment.ShowEmployeeNumber !== this._bShowEmployeeNumber) {
						if (this._oDialog) {
							this.removeDependent(this._oDialog);
							this._oDialog.destroy();
							this._oDialog = null;
						}
						this._bShowEmployeePicture = oAssignment.ShowEmployeePicture;
						this._bShowEmployeeNumber = oAssignment.ShowEmployeeNumber;
					}

					if (!this._oDialog) {
						// create the on behalf dialog (including a list with the employees)
						// base attributes
						var objectListItemConfig = {
							title: "{EmployeeName}",
							selected: false
						};
						// add employee number?
						if (this._bShowEmployeeNumber) {
							objectListItemConfig.attributes = [
								new ObjectAttribute({
									title: this.oResourceBundle.getText("employeeNumberLabel"),
									text: {
										formatter: this._formatEmployeeNumber,
										parts: ["EmployeeId", "/showEmployeeNumberWithoutZeros"]
									}
								})
							];
						}
						// add employee picture?
						if (this._bShowEmployeePicture) {
							objectListItemConfig.icon = {
								formatter: this._formatEmployeePictureUrl,
								parts: ["toEmployeePicture"]
							};
							objectListItemConfig.iconDensityAware = false;
						}
						var itemTemplate = new ObjectListItem(objectListItemConfig);

						this._oSearchField = new SearchField({
							search: function (oEvent) {
								var sValue = oEvent.getParameter("query").toLowerCase();
								var bShowEmployeeNumber = this._bShowEmployeeNumber;
								var bShowEmployeeNumberWithoutZeros = this._oLocalModel.getProperty("/showEmployeeNumberWithoutZeros");
								var oFilter = new Filter({
									path: "",
									test: function (oValue) {
										if (bShowEmployeeNumber) {
											var employeeId = (bShowEmployeeNumberWithoutZeros ? "" + parseInt(oValue.EmployeeId, 10) : oValue.EmployeeId);
											if (employeeId.toLowerCase().indexOf(sValue) !== -1) {
												return true;
											}
										}
										return oValue.EmployeeName.toLowerCase().indexOf(sValue) !== -1;
									}
								});
								this._oEmployeeList.getBinding("items").filter([oFilter], sap.ui.model.FilterType.Application);
							}.bind(this)
						});
						this._oEmployeeList = new List({
							items: {
								path: "/onBehalfEmployeeList",
								templateShareable: false,
								template: itemTemplate,
								key: "EmployeeId",
								sorter: new Sorter("EmployeeCategory", true, true),
								groupHeaderFactory: this.getGroupHeaderFactory.bind(this)
							},
							selectionChange: this.onPernrSelected.bind(this),
							mode: ListMode.SingleSelectMaster,
							headerToolbar: new Toolbar({
								content: [this._oSearchField]
							})
						});
						this._oDialog = new Dialog({
							title: this.oResourceBundle.getText("onBehalfDialogTitle"),
							stretch: Device.system.phone,
							content: this._oEmployeeList,
							contentHeight: !Device.system.phone ? "60%" : undefined,
							contentWidth: !Device.system.phone ? "30rem" : undefined,
							beginButton: new Button({
								text: this.oResourceBundle.getText("cancelButtonText"),
								tooltip: this.oResourceBundle.getText("cancelButtonOnBehalfTooltip"),
								press: function () {
									this._oDialog.close();
								}.bind(this)
							})
						});
						this._oDialog.setModel(this._oLocalModel);
						this.addDependent(this._oDialog);
					} else {
						// dialog already created
						this._oSearchField.setValue("");
						this._oEmployeeList.getBinding("items").filter([], sap.ui.model.FilterType.Application);
					}

					this._oEmployeeList.getItems().forEach(function (oItem) {
						oItem.setSelected(false);
					});
					this._oDialog.open();

				}.bind(this));
			}
		},

		// handler for item click in the on behalf list
		onPernrSelected: function (oEvent) {
			// on behalf dialog was closed
			// check if PERNR was changed
			var oItem = oEvent.getParameter("listItem");
			var selectedPernr = oItem.getBindingContext().getProperty("EmployeeId");
			var currentPernr = this.getProperty("onBehalfEmployeeId");
			if (currentPernr !== selectedPernr) {
				// remember that we activate on behalf directly
				var applicationId = this.getProperty("applicationId");
				CommonModelManager.setActivatedOnBehalf(applicationId, true);
				CommonModelManager.setOnBehalfEmployeeId(this._sAssignmentId, selectedPernr, applicationId);
				
				this.setOnBehalfEmployeeId(selectedPernr);

				// raise event for application
				this._oDialog.close();
				this.fireEvent("assignmentChange", {
					selectedAssignment: selectedPernr
				});
			}
		},

		// grouping function for on behalf list (group by colleagues, manager, direct reports)
		getGroupHeaderFactory: function (oGroup) {
			var sGroupTitle = "";
			switch (oGroup.key) {
			case "BOSS":
				sGroupTitle = this.oResourceBundle.getText("colleagueListGroupTitleManager");
				break;
			case "COLLEAGUE":
				sGroupTitle = this.oResourceBundle.getText("colleagueListGroupTitleColleague");
				break;
			case "DIRECTREPORT":
				sGroupTitle = this.oResourceBundle.getText("colleagueListGroupTitleDirectReport");
				break;
			}

			return new GroupHeaderListItem({
				title: sGroupTitle,
				upperCase: false
			});
		},

		_queueReadRequest: function () {
			if (this._queuedReadRequest) {
				jQuery.sap.clearDelayedCall(this._queuedReadRequest);
			}
			this._queuedReadRequest = jQuery.sap.delayedCall(0, this, "_readOnBehalfData");
		},

		// initialize the on behalf data data (ODATA backend call)
		_readOnBehalfData: function () {
			// verify that required properties are set
			var applicationId = this.getProperty("applicationId");
			var assignmentId = this._sAssignmentId;
			if (!applicationId || !assignmentId) {
				return;
			}

			// reset data visiblity
			if (this._bHasDataVisible) {
				this._bHasDataVisible = false;
				this._updateVisibleInternal();
			}

			// read backend data
			CommonModelManager.getOnBehalfEmployeeList(assignmentId, applicationId).then(function (oResults) {
				var oData = oResults;
				this._oLocalModel.setSizeLimit(oData.length);
				this._oLocalModel.setProperty("/onBehalfEmployeeList", oData);

				if (oData.length > 0) {
					// multiple assignments exist -> make the CE button visible
					this._bHasDataVisible = true;
					this._updateVisibleInternal();
				}
				this.fireEvent("employeesLoaded", {
					numberOfEmployees: oData.length,
					hasOnBehalfEmployees: oData.length > 0
				});
			}.bind(this));
		},

		_updateVisibleInternal: function () {
			// if onbehalf is active: only triggering app can deactivate it, else use state from assignment
			var bState = this.getOnBehalfEmployeeId() ? CommonModelManager.canDeactivateOnBehalf(this.getProperty("applicationId")) : this._bStateVisible;
			this.setProperty("visible", !!this._bManualVisible && this._bHasDataVisible && bState);
		},

		_updateButton: function (bActive) {
			if (bActive) {
				//only set icon if in ObjectPageHeaderActioButton icon is visible
				if (!(this.getHideIcon && this.getHideIcon())) {
					this.setIcon("sap-icon://reset");
				}
				this.setText(this.oResourceBundle.getText("onBehalfButtonActiveText"));
				this.setTooltip(this.oResourceBundle.getText("onBehalfButtonActiveTooltip"));
			} else {
				//only set icon if in ObjectPageHeaderActioButton icon is visible
				if (!(this.getHideIcon && this.getHideIcon())) {
					this.setIcon("sap-icon://group");
				}
				this.setText(this.oResourceBundle.getText("onBehalfButtonText"));
				this.setTooltip(this.oResourceBundle.getText("onBehalfButtonTooltip"));
			}
		},

		setAssignmentId: function (assignmentId) {
			if (!assignmentId || this.getAssignmentId() === assignmentId) {
				return;
			}

			this.setProperty("assignmentId", assignmentId);

			// only accept this assignment if the pernr belongs to on of the CE assignments
			jQuery.sap.delayedCall(0, this, function () {
				var applicationId = this.getApplicationId();
				CommonModelManager.isConcurrentEmploymentAssignment(assignmentId, applicationId).then(function (isCE) {
					if (!isCE) {
						return;
					}

					// load data for this assignment
					this._sAssignmentId = assignmentId;
					this._queueReadRequest();

					CommonModelManager.getAssignmentInformation(assignmentId, applicationId).then(function (oAssignment) {
						if (oAssignment) {
							this._bStateVisible = oAssignment.IsOnBehalfEnabled;
							this._oLocalModel.setProperty("/showEmployeeNumberWithoutZeros", oAssignment.ShowEmployeeNumberWithoutZeros);
							this._updateVisibleInternal();
						}
					}.bind(this));
				}.bind(this));
			}.bind(this));
		},

		setApplicationId: function (applicationId) {
			if (!applicationId) {
				return;
			}

			this.setProperty("applicationId", applicationId);
			this._queueReadRequest();

			// new API, register event bus
			this._registerEventBus(applicationId);
		},

		setOnBehalfEmployeeId: function (onBehalfEmployeeId) {
			if ( /*!onBehalfEmployeeId ||*/ this.getOnBehalfEmployeeId() === onBehalfEmployeeId) {
				return;
			}

			/*TO DO* /
			console.log("OnBehalfButton - OnBehalf changed: " + onBehalfEmployeeId);
			/ *TO DO*/

			this.setProperty("onBehalfEmployeeId", onBehalfEmployeeId);
			
			// leading zeros
			var applicationId = this.getApplicationId();
			CommonModelManager.getAssignmentInformation(onBehalfEmployeeId, applicationId).then(function (oAssignment) {
				if (oAssignment) {
					this._oLocalModel.setProperty("/showEmployeeNumberWithoutZeros", oAssignment.ShowEmployeeNumberWithoutZeros);
				}
			}.bind(this));


			// update button text/style
			this._updateButton(!!onBehalfEmployeeId);

			// update visibility
			this._updateVisibleInternal();
		},

		setVisible: function (visible) {
			this._bManualVisible = visible;
			this._updateVisibleInternal();
		}
	};

	return OnBehalfButtonBase;
});