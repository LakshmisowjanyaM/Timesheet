/*
 * Copyright (C) 2009-2020 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/mytimesheet/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"hcm/fab/mytimesheet/model/formatter",
	'sap/m/MessagePopover',
	'sap/m/MessagePopoverItem',
	"sap/ui/core/routing/History",
	"sap/m/Dialog",
	"sap/m/Text"
], function (BaseController,
	JSONModel, formatter, MessagePopover, MessagePopoverItem, History, Dialog, Text) {
	"use strict";
	/**
	 * Sets the error state of controls that use a data type. 
	 *
	 * @param {object} oEvent
	 *   the event raised by UI5 when validation occurs.    
	 */
	function controlErrorHandler(oEvent) {
		var oControl = oEvent.getParameter("element");
		var sErrorMessage = oEvent.getParameter("message");

		if (oControl && oControl.setValueStateText && sErrorMessage) {
			oControl.setValueStateText(sErrorMessage);
		}
		if (oControl && oControl.setValueState) {
			oControl.setValueState("Error");
		}
	}
	/**
	 * Sets the normal state of controls that passed a validation.
	 *
	 * @param {object} oEvent
	 *   the event raised by UI5 when validation occurs.
	 */
	function controlNoErrorHandler(oEvent) {
		var oControl = oEvent.getParameter("element");
		if (oControl && oControl.setValueState) {
			oControl.setValueState("None");
		}
	}
	return BaseController.extend("hcm.fab.mytimesheet.controller.EditAssignment", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf hcm.fab.mytimesheet.view.view.EditAssignment
		 */
		onInit: function () {
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0
				});
			this._nCounter = 0;
			this.setGlobalModel(new sap.ui.model.json.JSONModel(this), "thisModel");
			this.oBundle = this.getResourceBundle();
			var oModel = this.getGlobalModel("ProfileFields");
			var oControl = this.getGlobalModel("controls");
			this.oControl = oControl;
			this.busyDialog = new sap.m.BusyDialog();
			var oEditModel = this.getGlobalModel("EditedTask1");
			var date1 = new Date(oEditModel.oData.validFrom);
			// var date2 = new Date(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
			//	oEditModel.oData.validFrom = date2;
			// if ( !isNaN(date2.getDate())) {
			oEditModel.setProperty("/validFrom", date1);
			// }
			date1 = new Date(oEditModel.oData.validTo);
			// date2 = new Date(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
			//	oEditModel.oData.validTo = date2;
			// if ( !isNaN(date2.getDate())) {
			oEditModel.setProperty("/validTo", date1);
			// }
			this.oFormatYyyymmdd = sap.ui.core.format.DateFormat.getInstance({
				pattern: "yyyy-MM-dd",
				calendarType: sap.ui.core.CalendarType.Gregorian
			});
			// this.setModel(oControl, "controls");
			this.setModel(oEditModel, "EditedTask1").updateBindings();
			this.oRouter = this.getRouter();
			var oPernr = this.getPernr();
			if (!oPernr) {
				this.oRouter.navTo("worklist", {}, true);
			} else {
				this.empID = oPernr.getData();
			}
			this.oDataModel = this.getOwnerComponent().getModel();
			this.oBundle = this.getResourceBundle();
			this.oErrorHandler = this.getOwnerComponent()._oErrorHandler;
			this.oRouter.getRoute("editAssignment").attachMatched(this._onObjectMatched.bind(this), this);
			var oModel = new JSONModel({
				reloadTasks: false
			});
			this.setGlobalModel(oModel, "TaskReload");
			if (oControl) {
				oControl.setProperty("/showFooterAssignment", false);
				if (oControl.getProperty("/displayAssignment") === true) {
					// this.assignmentFragment("DisplayTaskHeader", "DisplayTaskDetails");
					this.byId("displayDetailsBlockId").setVisible(true);
					this.byId("editHeaderBlockId").setVisible(false);
					this.byId("editDetailsBlockId").setVisible(false);
					this.byId("detailSectionId").setProperty("showTitle", false);
					this.setModel(new JSONModel({
						"Name": oEditModel.getData().AssignmentName
					}), "Title");
				} else {
					// this.assignmentFragment("EditTaskHeader", "EditTaskDetails");
					this.byId("editHeaderBlockId").setVisible(true);
					this.byId("editDetailsBlockId").setVisible(true);
					this.byId("displayDetailsBlockId").setVisible(false);
					this.byId("ObjectPageLayout").getHeaderTitle().setProperty("objectSubtitle", "");
					this.byId("detailSectionId").setProperty("showTitle", true);
					oControl.setProperty("/showFooterAssignment", true);
				}
			}
			// Handle validation
			this.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
			sap.ui.getCore().attachParseError(controlErrorHandler);
			sap.ui.getCore().attachValidationSuccess(controlNoErrorHandler);
			sap.ui.getCore().getMessageManager().registerObject(this.getView(), true);

		},
		onDisplayCancel: function () {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oControl = this.getModel("controls");
			// oControl.setProperty('/assignmentTitle', this.oBundle.getText("displayAssignment"));
			oControl.setProperty('/displayAssignment', true);
			oControl.setProperty('/displayAssignmentCancel', false);
			// if (oControl.getProperty('/displayAssignment') && oControl.getProperty('/displayAssignment') === true) {
			// this.assignmentFragment("DisplayTaskHeader", "DisplayTaskDetails");
			oControl.setProperty("/showFooterAssignment", false);
			this.byId("displayDetailsBlockId").setVisible(true);
			this.byId("editHeaderBlockId").setVisible(false);
			this.byId("editDetailsBlockId").setVisible(false);
			this.byId("detailSectionId").setProperty("showTitle", false);
			// } else {
			// this.oRouter.navTo("worklist", {}, true);
			// }
		},
		onDisplayCancelConfirm: function () {
			this.showConfirmBox(this.onDisplayCancel.bind(this));
		},
		handleConfirmationYesButton: function (oEvent) {
			this._confirmationFunction();
		},
		handleConfirmationNoButton: function (oEvent) {
			this._oPopover.close();
		},
		showConfirmBox: function (oEvent, ok) {
			if (!this._oPopover) {
				this._oPopover = sap.ui.xmlfragment("hcm.fab.mytimesheet.view.fragments.ConfirmationPopOver", this);
				this.getView().addDependent(this._oPopover);
			}
			this._oPopover.openBy(oEvent.getSource());
			this._confirmationFunction = ok;
		},
		// onTaskDeleteConfirm: function (oEvent) {
		// 	this.showConfirmBox(oEvent, this.onTaskDelete.bind(this));
		// },
		onTaskDeleteConfirm: function (oEvent) {
			var that = this;
			var messageHeader = "";
			var oData = this.getGlobalModel("selectedAssignment").getData();
			if (oData.ToGrps.results.length > 0) {
				messageHeader = that.oBundle.getText("confirmationDeleteAssignmentWithGroup");
			} else {
				messageHeader = that.oBundle.getText("confirmationDeleteAssignment");
			}
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			sap.m.MessageBox.warning(
				messageHeader, {
					title: that.oBundle.getText("delete"),
					actions: [sap.m.MessageBox.Action.DELETE, sap.m.MessageBox.Action.CANCEL],
					styleClass: bCompact ? "sapUiSizeCompact" : "",
					onClose: function (sAction) {
						if (sAction === "DELETE") {
							that.onTaskDelete();
						}
					}
				}
			);
		},
		_onObjectMatched: function (oEvent) {
			var oModel = this.getGlobalModel("ProfileFields");
			var oControl = this.getGlobalModel("controls");
			this.oControl = oControl;
			var oEditModel = this.getGlobalModel("EditedTask1");
			this.oFormatYyyymmdd = sap.ui.core.format.DateFormat.getInstance({
				pattern: "yyyy-MM-dd",
				calendarType: sap.ui.core.CalendarType.Gregorian
			});
			this.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
			// Handle validation
			sap.ui.getCore().attachParseError(controlErrorHandler);
			sap.ui.getCore().attachValidationSuccess(controlNoErrorHandler);
			sap.ui.getCore().getMessageManager().registerObject(this.getView(), true);
			if (oControl.getProperty('/createAssignment') === true) {
				oEditModel.getData().status = true;
			}
			this.setModel(oControl, "controls");
			this.setModel(oEditModel, "EditedTask1");
			if (oControl) {
				if (oControl.getProperty('/displayAssignment') === true) {
					// this.assignmentFragment("DisplayTaskHeader", "DisplayTaskDetails");
					oControl.setProperty("/showFooterAssignment", false);
					this.byId("displayDetailsBlockId").setVisible(true);
					this.byId("editHeaderBlockId").setVisible(false);
					this.byId("editDetailsBlockId").setVisible(false);
					this.byId("detailSectionId").setProperty("showTitle", false);
					this.setModel(new JSONModel({
						"Name": oEditModel.getData().name
					}), "Title");
				} else {
					// this.assignmentFragment("EditTaskHeader", "EditTaskDetails");
					oControl.setProperty("/showFooterAssignment", true);
					this.byId("editHeaderBlockId").setVisible(true);
					this.byId("editDetailsBlockId").setVisible(true);
					this.byId("displayDetailsBlockId").setVisible(false);
					this.byId("ObjectPageLayout").getHeaderTitle().setProperty("objectSubtitle", "");
					this.byId("detailSectionId").setProperty("showTitle", true);
					oControl.setProperty("/showFooterAssignment", true);
					if (oControl.getProperty('/editAssignment') === true) {
						this.setModel(new JSONModel({
							"Name": this.oBundle.getText("editAssignment")
						}), "Title");
					} else if (oControl.getProperty('/copyAssignment') === true) {
						this.setModel(new JSONModel({
							"Name": this.oBundle.getText("copyAssignment")
						}), "Title");
					} else if (oControl.getProperty('/createAssignment') === true) {
						this.setModel(new JSONModel({
							"Name": this.oBundle.getText("createAssignment")
						}), "Title");
					} else {
						this.setModel(new JSONModel({
							"Name": this.oBundle.getText("displayAssignment")
						}), "Title");
					}

				}
			}
			this.fireHeader();
		},
		_getFormFragment: function (sFragmentName) {
			var oFormFragment = this._formFragments[sFragmentName];
			if (oFormFragment) {
				return oFormFragment;
			}
			oFormFragment = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments." + sFragmentName, this);
			this._formFragments[sFragmentName] = oFormFragment;
			return this._formFragments[sFragmentName];
		},
		_formFragments: {},
		assignmentFragment: function (sFragmentName1, sFragmentName2) {
			var oPage1 = this.byId("Section1");
			var oPage2 = this.byId("Section2");
			// var oPage1 = this.byId("editAssignmentHeader");
			// var oPage2 = this.byId("editDetailsBlock");
			// if (this.oControl.getProperty('/displayAssignment') && this.oControl.getProperty('/displayAssignment') === true) {

			// } else {

			// }
			oPage1.removeAllBlocks();
			oPage2.removeAllBlocks();
			// oPage1.removeAllContent();
			// oPage2.removeAllContent();
			oPage1.addBlock(this._getFormFragment(sFragmentName1));
			oPage2.addBlock(this._getFormFragment(sFragmentName2));
			this.fireHeader();
			// oPage1.addContent(this._getFormFragment(sFragmentName1));
			// oPage2.addContent(this._getFormFragment(sFragmentName2));
		},
		onEdit: function () {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oEditModel = this.getGlobalModel("EditedTask1");
			//Creating a deep copy of data
			var oEditData = JSON.parse(JSON.stringify(this.getGlobalModel("EditedTask2").getData()));
			oEditData.validFrom = new Date(oEditData.validFrom);
			oEditData.validTo = new Date(oEditData.validTo);
			oEditModel.setData(oEditData);
			var date1 = new Date(oEditModel.oData.validFrom);
			// var date2 = new Date(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
			//oEditModel.oData.validFrom = date2;
			oEditModel.setProperty("/validFrom", date1);
			var date2 = new Date(oEditModel.oData.validTo);
			// date2 = new Date(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
			// oEditModel.oData.validTo = date2;
			oEditModel.setProperty("/validTo", date2);
			this.oFormatYyyymmdd = sap.ui.core.format.DateFormat.getInstance({
				pattern: "yyyy-MM-dd",
				calendarType: sap.ui.core.CalendarType.Gregorian
			});
			// this.setModel(oControl, "controls");
			this.setModel(oEditModel, "EditedTask1").updateBindings();
			var oControl = this.getModel("controls");
			oControl.setProperty('/assignmentTitle', this.oBundle.getText("editAssignment"));
			oControl.setProperty('/displayAssignment', false);
			oControl.setProperty('/editAssignment', true);
			oControl.setProperty('/editAssignmentCancel', false);
			oControl.setProperty('/displayAssignmentCancel', true);
			oControl.setProperty("/showFooterAssignment", true);
			// this.assignmentFragment("EditTaskHeader", "EditTaskDetails");
			this.byId("editHeaderBlockId").setVisible(true);
			this.byId("editDetailsBlockId").setVisible(true);
			this.byId("displayDetailsBlockId").setVisible(false);
			this.byId("ObjectPageLayout").getHeaderTitle().setProperty("objectSubtitle", "");
			this.byId("detailSectionId").setProperty("showTitle", true);
			oControl.setProperty("/showFooterAssignment", true);
			this.fireHeader();
		},
		onExit: function () {
			// this.byId("dynamicPageId").destroy();
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oModel = new JSONModel();
			var data = [];
			oModel.setData(data);
			this.setModel(oModel, "EditedTask1");
			this.setModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "EditedTask1");
		},
		showBusy: function () {
			this._nCounter++;
			if (this._nCounter === 1) {
				this.busyDialog.open();
			}
		},
		hideBusy: function (forceHide) {
			if (this._nCounter === 0) {
				return;
			}
			this._nCounter = forceHide ? 0 : Math.max(0,
				this._nCounter - 1);
			if (this._nCounter > 0) {
				return;
			}
			this.busyDialog.close();
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oViewModel = this.getModel("objectView"),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			var oResourceBundle = this.getResourceBundle(),
				oObject = oView.getBindingContext().getObject(),
				sObjectId = oObject.Pernr,
				sObjectName = oObject.ApproverMandatory;

			// Everything went fine.
			oViewModel.setProperty("/busy", false);
			oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("saveAsTileTitle", [sObjectName]));
			oViewModel.setProperty("/shareOnJamTitle", sObjectName);
			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		},
		/**
		 * Handled when user clicks on back button to navigate to previous screen
		 */
		onNavBack: function () {
			this.byId("dynamicPageId").destroy();
			// sap.ui.getCore().getMessageManager().removeAllMessages();
			var oModel = new JSONModel();
			var data = [];
			oModel.setData(data);
			this.setModel(oModel, "EditedTask1");
			this.setModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "EditedTask1");
			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			this._deleteUnsavedRecord();

			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				history.go(-1);
			} else {
				oCrossAppNavigator.toExternal({
					target: {
						shellHash: "#Shell-home"
					}
				});
			}
			this.getRouter().navTo("worklist", {}, true);
		},
		onBack: function () {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oModel = new JSONModel();
			var data = [];
			oModel.setData(data);
			this.setModel(oModel, "EditedTask1");
			this.setModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "EditedTask1");
			this.getRouter().navTo("worklist", {}, true);
		},
		onCancel: function () {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			// var oModel = new JSONModel();
			// var data = [];
			// oModel.setData(data);
			// this.setModel(oModel, "EditedTask");
			// this.setModel(oModel, "DisplayTask");
			// this.setGlobalModel(oModel, "DisplayTask");
			// this.setGlobalModel(oModel, "EditedTask");
			// this.oControl.setProperty("/displayAssignment", true);
			// this.oControl.setProperty("/displayAssignmentCancel", false);
			// this.byId("displayDetailsBlockId").setVisible(true);
			// this.byId("editHeaderBlockId").setVisible(false);
			// this.byId("editDetailsBlockId").setVisible(false);
			// this.byId("detailSectionId").setProperty("showTitle", false);
			// this.assignmentFragment("DisplayTaskHeader", "DisplayTaskDetails");
			this.getRouter().navTo("worklist", {}, true);
		},
		onValueHelp: function (oEvent) {
			var that = this;
			var FieldName = oEvent.getSource().getCustomData('FieldName')[0].getValue();
			var FieldLabel = oEvent.getSource().getCustomData('FieldLabel')[2].getValue();
			var oControl = this.getModel("controls");
			oControl.setProperty("/fieldLabel", FieldLabel);
			this.setModel(oControl, "controls");
			new Promise(
				function (fnResolve, fnReject) {
					that.getValueHelpCollection(FieldName, oEvent.getSource());
					fnResolve(
						// that.valueHelpFragment(oEvent.getSource())
					);
					fnReject();
				}
			);
		},
		valueHelpFragment: function (oSource) {
			var that = this;
			var oView = this.getView();
			this.oValueHelpSource = oSource;
			// create dialog lazily
			var oDialog;
			// if (!oDialog) {
			var oDialogController = {
				handleConfirm: that.handleClick.bind(this),
				handleCancel: function (oEvent) {
					oDialog.close();
					// oDialog.destroy();
					var data = [];
					var oModel = new JSONModel(data);
					that.setModel(oModel, "ValueHelp");
				}.bind(that),
				handleBeforeOpen: function (oEvent) {
					// // var oTable = oEvent.getSource().getTable();
					// var oModel = new JSONModel();
					// var data = that.getModel("ValueHelp").getData();
					// var columns = [];
					// // for(var i=0;i<data.length;i++){
					// columns.push({
					// 	label: data[0].DispField1Header,
					// 	template: data[0].DispField1Header
					// });
					// // var oColumn = new sap.m.Column({text:"Awart"});
					// if(data[0].DispField2Header !== ""){
					// columns.push({label:data[0].DispField2Header,template:data[0].DispField2Header});						
					// }
					// if(data[0].DispField3Header !== ""){
					// columns.push({label:data[0].DispField3Header,template:data[0].DispField3Header});						
					// }
					// if(data[0].DispField4Header !== ""){
					// columns.push({label:data[0].DispField4Header,template:data[0].DispField4Header});						
					// }					
					// // }
					// var cols = {cols:columns};
					// oModel.setData(cols);
					// oEvent.getSource().getTable().setModel(oModel,"columns");
					// var oRowsModel = new sap.ui.model.json.JSONModel();
					// oRowsModel.setData(this.oTableItems);
					// oEvent.getSource().getTable().setModel(oRowsModel);
					// if (oEvent.getSource().getTable().bindRows) {
					// 	oEvent.getSource().getTable().bindRows("/");
					// }
					// if (oEvent.getSource().getTable().bindItems) {
					// 	var oTable = oEvent.getSource().getTable();

					// 	oTable.bindAggregation("items", "/", function(sId, oContext) {
					// 		var aCols = oTable.getModel("columns").getData().cols;

					// 		return new sap.m.ColumnListItem({
					// 			cells: aCols.map(function(column) {
					// 				var colname = column.template;
					// 				return new sap.m.Label({
					// 					text: "{" + colname + "}"
					// 				});
					// 			})
					// 		});
					// 	});
					// }					
				},
				handleAfterOpen: function (oEvent) {
					// var oTable = oEvent.getSource().getTable();
					var oModel = new JSONModel();
					var data = that.getModel("ValueHelpHits").getData();
					var seldata = that.getModel("ValueHelp").getData();
					var columns = [];
					// for(var i=0;i<data.length;i++){
					columns.push({
						label: that.oBundle.getText("key"),
						template: "DispField1Id"
					});
					if (data[0].DispField1Header && data[0].DispField1Header !== "") {
						columns.push({
							label: data[0].DispField1Header,
							template: "DispField1Val"
						});
					}

					// var oColumn = new sap.m.Column({text:"Awart"});
					if (data[0].DispField2Header && data[0].DispField2Header !== "") {
						columns.push({
							label: data[0].DispField2Header,
							template: "DispField2Val"
						});
					}
					if (data[0].DispField3Header && data[0].DispField3Header !== "") {
						columns.push({
							label: data[0].DispField3Header,
							template: "DispField3Val"
						});
					}
					if (data[0].DispField4Header && data[0].DispField4Header !== "") {
						columns.push({
							label: data[0].DispField4Header,
							template: "DispField4Val"
						});
					}
					// }
					var cols = {
						cols: columns
					};
					oModel.setData(cols);
					oEvent.getSource().getTable().setModel(oModel, "columns");
					oEvent.getSource().setKey("DispField1Id");
					oEvent.getSource().setDescriptionKey("DispField1Val");
					var oRowsModel = new sap.ui.model.json.JSONModel();
					oRowsModel.setData(data);
					oEvent.getSource().getTable().setModel(oRowsModel);
					if (oEvent.getSource().getTable().bindRows) {
						oEvent.getSource().getTable().bindRows("/");
					}
					if (oEvent.getSource().getTable().bindItems) {
						var oTable = oEvent.getSource().getTable();

						oTable.bindAggregation("items", "/", function (sId, oContext) {
							var aCols = oTable.getModel("columns").getData().cols;

							return new sap.m.ColumnListItem({
								cells: aCols.map(function (column) {
									var colname = column.template;
									return new sap.m.Label({
										text: "{" + colname + "}"
									});
								})
							});
						});
					}
					// oEvent.getSource().setTokens(this.oMultiInput.getTokens());
					var filter = [];
					if (seldata.SelField1Text && seldata.SelField1Text !== "") {
						filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
							groupTitle: "searchFields",
							groupName: "Assignment",
							name: seldata.SelField1Name,
							label: seldata.SelField1Text,
							control: new sap.m.Input()
						}));
					}
					if (seldata.SelField2Text && seldata.SelField2Text !== "") {
						filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
							groupTitle: "searchFields",
							groupName: "Assignment",
							name: seldata.SelField2Name,
							label: seldata.SelField2Text,
							control: new sap.m.Input()
						}));
					}
					if (seldata.SelField3Text && seldata.SelField3Text !== "") {
						filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
							groupTitle: "searchFields",
							groupName: "Assignment",
							name: seldata.SelField3Name,
							label: seldata.SelField3Text,
							control: new sap.m.Input()
						}));
					}
					if (seldata.SelField4Text && seldata.SelField4Text !== "") {
						filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
							groupTitle: "searchFields",
							groupName: "Assignment",
							name: seldata.SelField4Name,
							label: seldata.SelField4Text,
							control: new sap.m.Input()
						}));
					}

					var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
						advancedMode: true,
						filterBarExpanded: false,
						showGoOnFB: !sap.ui.Device.system.phone,
						filterGroupItems: filter,
						search: function (oEvent) {
							var a = oEvent;
						}
					});

					if (oFilterBar.setBasicSearch) {
						oFilterBar.setBasicSearch(new sap.m.SearchField({
							showSearchButton: sap.ui.Device.system.phone,
							placeholder: "Search",
							search: function (event) {
								oEvent.getSource().getFilterBar().search();
							}
						}));
					}

					oEvent.getSource().setFilterBar(oFilterBar);
					oEvent.getSource().update();
				},
				handleAfterClose: function (oEvent) {
					oDialog.destroy();
				},
				handleClickValueHelp: that.handleClick.bind(that)
			};
			// create dialog via fragment factory
			oDialog = sap.ui.xmlfragment(oView.getId(), "hcm.fab.mytimesheet.view.fragments.ValueHelpDialog", oDialogController);
			// connect dialog to view (models, lifecycle)
			oView.addDependent(oDialog);
			// }
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oDialog);

			jQuery.sap.delayedCall(0, this, function () {
				oDialog.open();
			});
		},

		getValueHelpCollection: function (FieldName, oSource) {
			var that = this;
			this.showBusy();
			var oModel = new JSONModel();
			var orgModel = new JSONModel();
			var f = [];
			// var a = new sap.ui.model.Filter({
			// 	path: "StartDate",
			// 	operator: sap.ui.model.FilterOperator.EQ,
			// 	value1: this.oFormatYyyymmdd.format(that.startDate)
			// });
			// var b = new sap.ui.model.Filter({
			// 	path: "EndDate",
			// 	operator: sap.ui.model.FilterOperator.EQ,
			// 	value1: this.oFormatYyyymmdd.format(that.endDate)
			// });
			// var oFormContainers = this.getModel("EditedTask").getData().containers;
			// var selectedFieldName = FieldName;
			// for (var j = 0; j < oFormContainers.length; j++) {
			// 	for (var i = 0; i < oFormContainers[j].form.length; i++) {
			// 		var fieldValue = oFormContainers[j].form[i].FieldValue;
			// 		var fieldName = oFormContainers[j].form[i].FieldName;
			// 		var lc_separator = ";;";
			// 		var lv_search_str = "";
			// 		if (oFormContainers[j].form[i].FieldName ==
			// 			"AssignmentName") {
			// 			continue;
			// 		} else if (oFormContainers[j].form[i].FieldName ==
			// 			"APPROVER") {
			// 			continue;
			// 		} else if (oFormContainers[j].form[i].FieldName ==
			// 			"AssignmentStatus") {
			// 			continue;
			// 		} else {
			// 			if (fieldValue.length !== 0 && fieldName !== selectedFieldName) {
			// 				var lv_search_str_temp = fieldName + "=" + fieldValue;
			// 				if (lv_search_str) {
			// 					lv_search_str += lc_separator + lv_search_str_temp;
			// 				} else {
			// 					lv_search_str += lv_search_str_temp;
			// 				}
			// 			}
			// 		}
			// 	}
			// }
			var c = new sap.ui.model.Filter({
				path: "Pernr",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.empID
			});
			var d = new sap.ui.model.Filter({
				path: "FieldName",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: FieldName
			});
			// var e = new sap.ui.model.Filter({
			// 	path: "FieldRelated",
			// 	operator: sap.ui.model.FilterOperator.EQ,
			// 	value1: lv_search_str
			// });
			// f.push(a);
			// f.push(b);
			f.push(c);
			f.push(d);
			// f.push(e);
			var mParameters = {
				urlParameters: '$expand=ValueHelpHits',
				filters: f,
				success: function (oData, oResponse) {
					that.results = oData.results[0].ValueHelpHits.results;
					oModel.setData(that.results);
					that.setModel(oModel, "ValueHelpHits");
					orgModel.setData(oData.results[0]);
					that.setModel(orgModel, "ValueHelp");
					that.hideBusy(true);
					that.valueHelpFragment(oSource);
				},
				error: function (oError) {
					that.hideBusy(true);
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.read('/ValueHelpCollection', mParameters);
		},
		handleClick: function (oEvent) {
			var value = oEvent.getParameter('tokens');
			this.oValueHelpSource.setValue(value[0].getKey());
			oEvent.getSource().close();
		},
		onSave: function (oEvent) {
			var that = this;
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oControl = this.getModel("controls");
			var oContainer = this.getGlobalModel("EditedTask1").getData().fields;

			var oEditedTask = this.getModel("EditedTask1").getData();
			var oMessages = [];
			var invalidBracket;
			var valid = /^(([\w\d\-_\s(]*[\w\d\-_\s\)]))$/g;
			//check if permitted brackets are used correctly
			//If editedTask name is not undefined then it might cause some issues
			if (oEditedTask.name) {
				if (oEditedTask.name.toString().includes("(") && !oEditedTask.name.toString().includes(")")) {
					invalidBracket = true;
				} else if ((oEditedTask.name.toString().includes(")")) && (!oEditedTask.name.toString().includes("("))) {
					invalidBracket = true;
				}
				if (invalidBracket === true) {
					this.getModel("EditedTask1").setProperty("/assignmentNameError", "Error");
					this.getModel("EditedTask1").setProperty("/assignmentNameErrorText", this.oBundle.getText("enterValidName"));
					oMessages.push(new sap.ui.core.message.Message({
						message: this.oBundle.getText("enterValidName"),
						type: sap.ui.core.MessageType.Error,
						processor: this.getOwnerComponent().oMessageProcessor
					}));
				}
			}
			//check for assignment name - should not contain special characters
			if (oEditedTask.name === "" || oEditedTask.name === null) {
				this.getModel("EditedTask1").setProperty("/assignmentNameError", "Error");
				this.getModel("EditedTask1").setProperty("/assignmentNameErrorText", this.oBundle.getText("enterValidName"));
				oMessages.push(new sap.ui.core.message.Message({
					message: this.oBundle.getText("enterValidName"),
					type: sap.ui.core.MessageType.Error,
					processor: this.getOwnerComponent().oMessageProcessor
				}));
			} else if (!valid.test(oEditedTask.name)) {
				this.getModel("EditedTask1").setProperty("/assignmentNameError", "Error");
				this.getModel("EditedTask1").setProperty("/assignmentNameErrorText", this.oBundle.getText("specialCharacterError"));
				oMessages.push(new sap.ui.core.message.Message({
					message: this.oBundle.getText("specialCharacterError"),
					type: sap.ui.core.MessageType.Error,
					processor: this.getOwnerComponent().oMessageProcessor
				}));
			} else {
				this.getModel("EditedTask1").setProperty("/assignmentNameError", "None");
				this.getModel("EditedTask1").setProperty("/assignmentNameErrorText", "");
			}
			if (!oEditedTask.validFrom || !oEditedTask.validTo) {
				this.getModel("EditedTask1").setProperty("/assignmentValidityError", "Error");
				this.getModel("EditedTask1").setProperty("/assignmentValidityErrorText", this.oBundle.getText("enterValidDates"));
				oMessages.push(new sap.ui.core.message.Message({
					message: this.oBundle.getText("enterValidDates"),
					type: sap.ui.core.MessageType.Error,
					processor: this.getOwnerComponent().oMessageProcessor
				}));
			} else {
				this.getModel("EditedTask1").setProperty("/assignmentValidityError", "None");
				this.getModel("EditedTask1").setProperty("/assignmentValidityErrorText", "");
			}
			var required = false;
			var startTime = null;
			var endTime = null;
			oContainer.forEach(function (element) {
				element.containers.forEach(function (element1) {
					element1.form.forEach(function (subElement) {
						if (subElement.Required === "X") {
							if (subElement.FieldValue === "") {
								subElement.valueState = "Error";
								subElement.valueStateText = that.oBundle.getText("requiredField");
								required = true;
							} else {
								subElement.valueState = "None";
								subElement.valueStateText = "";
							}
						}
						if (subElement.FieldName === "BEGUZ") {
							startTime = subElement;
							subElement.valueState = "None";
							subElement.valueStateText = "";
						}
						if (subElement.FieldName === "ENDUZ") {
							endTime = subElement;
							subElement.valueState = "None";
							subElement.valueStateText = "";
						}

					});
				});
			});

			try {
				if (startTime.FieldValue && !endTime.FieldValue) {
					oMessages.push(new sap.ui.core.message.Message({
						message: that.oBundle.getText("enterEndTime"),
						type: sap.ui.core.MessageType.Error,
						processor: this.getOwnerComponent().oMessageProcessor
					}));
					endTime.valueState = "Error";
					endTime.valueStateText = that.oBundle.getText("enterEndTime");
					startTime.valueState = "None";
					startTime.valueStateText = "";
				}
				if (!startTime.FieldValue && endTime.FieldValue) {
					oMessages.push(new sap.ui.core.message.Message({
						message: that.oBundle.getText("enterStartTime"),
						type: sap.ui.core.MessageType.Error,
						processor: this.getOwnerComponent().oMessageProcessor
					}));
					startTime.valueState = "Error";
					startTime.valueStateText = that.oBundle.getText("enterStartTime");
					endTime.valueState = "None";
					endTime.valueStateText = "";
				}
			} catch (noClockTimeExcpetion) {
				//Continue to normal flow if clock times are not visible in assignment screen
			}
			this.getModel("EditedTask1").refresh();
			if (required === true) {
				oMessages.push(new sap.ui.core.message.Message({
					message: that.oBundle.getText("requiredField"),
					type: sap.ui.core.MessageType.Error,
					processor: this.getOwnerComponent().oMessageProcessor
				}));
			}

			if (oMessages.length > 0) {
				sap.ui.getCore().getMessageManager().addMessages(
					oMessages
				);
				return;
			}
			delete oEditedTask.assignmentNameError;
			delete oEditedTask.assignmentNameErrorText;
			delete oEditedTask.assignmentValidityError;
			delete oEditedTask.assignmentValidityErrorText;
			if (startTime) {
				delete startTime.valueState;
				delete startTime.valueStateText;
			}
			if (endTime) {
				delete endTime.valueState;
				delete endTime.valueStateText;
			}

			oContainer.forEach(function (element) {
				element.containers.forEach(function (element1) {
					element1.form.forEach(function (subElement) {
						delete subElement.valueState;
						delete subElement.valueStateText;
					});
				});
			});
			var oFormContainers = [];
			//Sending all the data except the dummy data
			for (var index = 0; index < oContainer.length; index++) {
				for (var index1 = 0; index1 < oContainer[index].containers.length; index1++) {
					for (var index2 = 0; index2 < oContainer[index].containers[index1].form.length; index2++) {

						if (oContainer[index].containers[index1].form[index2].dummy === "true") {
							continue;
						} else {
							oFormContainers.push({
								form: [oContainer[index].containers[index1].form[index2]]
							});
						}
					}

				}
			}

			//	var oFormContainers = this.getModel("EditedTask").getData().containers;
			var TaskData = {
				ApproverId: "",
				ApproverName: "",
				AssignmentFields: {
					AENAM: "",
					ALLDF: "",
					APDAT: null,
					APNAM: "",
					ARBID: "",
					ARBPL: "",
					AUERU: "",
					AUFKZ: "",
					AUTYP: "",
					AWART: "",
					BEGUZ: "",
					BELNR: "",
					BEMOT: "",
					BUDGET_PD: "",
					BUKRS: "",
					BWGRL: "0.0",
					CATSAMOUNT: "0.0",
					CATSHOURS: "0.00",
					CATSQUANTITY: "0.0",
					CPR_EXTID: "",
					CPR_GUID: "",
					CPR_OBJGEXTID: "",
					CPR_OBJGUID: "",
					CPR_OBJTYPE: "",
					ENDUZ: "",
					ERNAM: "",
					ERSDA: null,
					ERSTM: "",
					ERUZU: "",
					EXTAPPLICATION: "",
					EXTDOCUMENTNO: "",
					EXTSYSTEM: "",
					FUNC_AREA: "",
					FUND: "",
					GRANT_NBR: "",
					HRBUDGET_PD: "",
					HRCOSTASG: "",
					HRFUNC_AREA: "",
					HRFUND: "",
					HRGRANT_NBR: "",
					HRKOSTL: "",
					HRLSTAR: "",
					KAPAR: "",
					KAPID: "",
					KOKRS: "",
					LAEDA: null,
					LAETM: "",
					LGART: "",
					LOGSYS: "",
					LONGTEXT: "",
					LONGTEXT_DATA: "",
					LSTAR: "",
					LSTNR: "",
					LTXA1: "",
					MEINH: "",
					OFMNW: "0.0",
					OTYPE: "",
					PAOBJNR: "",
					PEDD: null,
					PERNR: "",
					PLANS: "",
					POSID: "",
					PRAKN: "",
					PRAKZ: "",
					PRICE: "0.0",
					RAPLZL: "",
					RAUFNR: "",
					RAUFPL: "",
					REASON: "",
					REFCOUNTER: "",
					REINR: "",
					RKDAUF: "",
					RKDPOS: "",
					RKOSTL: "",
					RKSTR: "",
					RNPLNR: "",
					RPROJ: "",
					RPRZNR: "",
					SBUDGET_PD: "",
					SEBELN: "",
					SEBELP: "",
					SKOSTL: "",
					SPLIT: "0",
					SPRZNR: "",
					STATKEYFIG: "",
					STATUS: "",
					S_FUNC_AREA: "",
					S_FUND: "",
					S_GRANT_NBR: "",
					TASKCOMPONENT: "",
					TASKCOUNTER: "",
					TASKLEVEL: "",
					TASKTYPE: "",
					TCURR: "",
					TRFGR: "",
					TRFST: "",
					UNIT: "",
					UVORN: "",
					VERSL: "",
					VORNR: "",
					VTKEN: "",
					WABLNR: "",
					WAERS: "",
					WERKS: "",
					WORKDATE: null,
					WORKITEMID: "",
					WTART: ""
				},
				AssignmentId: "",
				AssignmentName: "",
				AssignmentOperation: "C",
				AssignmentStatus: "",
				Counter: "",
				Pernr: this.empID,
				ProfileId: ""
			};

			for (var j = 0; j < oFormContainers.length; j++) {
				for (var i = 0; i < oFormContainers[j].form.length; i++) {
					if (oFormContainers[j].form[i].FieldName ==
						"AssignmentName") {

					} else if (oFormContainers[j].form[i].FieldName ==
						"APPROVER") {
						TaskData["ApproverId"] =
							oFormContainers[j].form[i].FieldValue;
						TaskData["ApproverName"] =
							this.getModel("EditedTask1").getData().ApproverName;
					} else if (oFormContainers[j].form[i].FieldName ==
						"AssignmentStatus") {} else {
						TaskData.AssignmentFields[oFormContainers[j].form[i].FieldName] =
							oFormContainers[j].form[i].FieldValue;
					}
				}
			}
			if (TaskData.AssignmentFields.BWGRL === "") {
				TaskData.AssignmentFields.BWGRL = "0.00";
			}
			if (TaskData.AssignmentFields.PRICE === "") {
				TaskData.AssignmentFields.PRICE = "0.00";
			}
			if (TaskData.AssignmentFields.OFMNW === "") {
				TaskData.AssignmentFields.OFMNW = "0.00";
			}
			TaskData.AssignmentName = oEditedTask.name;
			TaskData.AssignmentStatus = oEditedTask.status ? "1" : "0";
			if (TaskData.AssignmentFields.BEGUZ) {
				TaskData.AssignmentFields.BEGUZ = this.formatter.convertAssignmentTime(TaskData.AssignmentFields.BEGUZ);
			}
			if (TaskData.AssignmentFields.ENDUZ) {
				TaskData.AssignmentFields.ENDUZ = this.formatter.convertAssignmentTime(TaskData.AssignmentFields.ENDUZ);
			}
			TaskData.ValidityStartDate = this.formatter.formatToBackendString(oEditedTask.validFrom) +
				"T00:00:00";
			TaskData.ValidityEndDate = this.formatter.formatToBackendString(oEditedTask.validTo) +
				"T00:00:00";
			if (TaskData.AssignmentFields.PEDD !== null && TaskData.AssignmentFields.PEDD !== "" && TaskData.AssignmentFields.PEDD) {
				TaskData.AssignmentFields.PEDD = this.formatter.formatToBackendString(new Date(TaskData.AssignmentFields.PEDD)) + "T00:00:00";
			} else {
				TaskData.AssignmentFields.PEDD = null;
			}
			TaskData.AssignmentId = oFormContainers[0].form[0].AssignmentId;
			if (oControl.getProperty("/editAssignment") || oControl.getProperty("/displayAssignment")) {
				//When assignment is updated then that assignment is deleted and a new assignment is created
				TaskData.AssignmentOperation = "C";
				this.onDeleteUpdatedTask(TaskData);
			} else if (oControl.getProperty("/createAssignment") || oControl.getProperty("/copyAssignment") || oControl.getProperty(
					"/copyAssignment") || oControl.getProperty("/importAssignment")) {
				TaskData.AssignmentOperation = "C";
				TaskData.AssignmentId = "";
				this.SubmitTask(TaskData);
			}

		},
		SubmitTask: function (TaskData) {
			var that = this;
			var oModel = new JSONModel();
			var mParameters = {
				success: function (oData, oResponse) {
					var data = oData.results;
					var toastMsg = that.oBundle.getText("taskSaved");
					// sap.m.MessageToast.show(toastMsg, {
					// 	duration: 1000
					// });
					var data = that.getGlobalModel("TaskReload").getData();
					data.reloadTasks = true;
					that.setGlobalModel(new JSONModel(data), "TaskReload");
					that.oRouter.navTo("worklist", {}, true);
				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.create('/AssignmentCollection', TaskData, mParameters);
			// this.oDataModel.submitChanges();
		},
		handleMessagePopover: function (oEvent) {
			var oMessageTemplate = new MessagePopoverItem({
				type: '{message>severity}',
				description: "{message>description}",
				title: '{message>message}',
				subtitle: "{message>additionalText}"
			});
			// if (!this.oMessagePopover) {
			var oMessagePopover = new MessagePopover({
				items: {
					path: "message>/",
					template: oMessageTemplate
				}
			});
			this.oMessagePopover = oMessagePopover;
			// }

			this.oMessagePopover.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
			this.oMessagePopover.toggle(oEvent.getSource());

		},
		onDeleteUpdatedTask: function (TaskData) {
			var that = this;
			var oData = this.getGlobalModel("selectedAssignment").getData();
			delete oData.ToGrps;
			oData.ValidityStartDate = this.oFormatYyyymmdd.format(oData.ValidityStartDate) + "T00:00:00";
			oData.ValidityEndDate = this.oFormatYyyymmdd.format(oData.ValidityEndDate) + "T00:00:00";
			oData.AssignmentOperation = "D";
			var mParameters = {
				success: function (oData, oResponse) {
					var data = that.getGlobalModel("TaskReload").getData();
					data.reloadTasks = true;
					that.setGlobalModel(new JSONModel(data), "TaskReload");
					that.UpdateTask(TaskData);
				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.create('/AssignmentCollection', oData, mParameters);
		},
		UpdateTask: function (TaskData) {
			var that = this;
			var oModel = new JSONModel();
			var mParameters = {
				success: function (oData, oResponse) {
					var toastMsg = that.oBundle.getText("tasksUpdatedSuccessfully");
					// sap.m.MessageToast.show(toastMsg, {
					// 	duration: 1000
					// });
					var data = that.getGlobalModel("TaskReload").getData();
					data.reloadTasks = true;
					that.setGlobalModel(new JSONModel(data), "TaskReload");
					that.oRouter.navTo("worklist", {}, true);
				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.create('/AssignmentCollection', TaskData, mParameters);
		},
		fireHeader: function () {
			try {
				this.getView().byId("ObjectPageLayout").getAggregation("_anchorBar").getAggregation("content")[0].firePress();
			} catch (exception) {}

		},
		onTaskDelete: function (oEvent) {
			var that = this;
			var oData = this.getGlobalModel("selectedAssignment").getData();
			delete oData.ToGrps;
			oData.ValidityStartDate = this.oFormatYyyymmdd.format(oData.ValidityStartDate) + "T00:00:00";
			oData.ValidityEndDate = this.oFormatYyyymmdd.format(oData.ValidityEndDate) + "T00:00:00";
			oData.AssignmentOperation = "D";
			var mParameters = {
				success: function (oData, oResponse) {
					var toastMsg = that.oBundle.getText("assignmentDeletedSuccessfully");
					// sap.m.MessageToast.show(toastMsg, {
					// 	duration: 1000
					// });
					var data = that.getGlobalModel("TaskReload").getData();
					data.reloadTasks = true;
					that.setGlobalModel(new JSONModel(data), "TaskReload");
					that.oRouter.navTo("worklist", {}, true);

				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.create('/AssignmentCollection', oData, mParameters);
		},
		/**
		 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
		 * (NOT before the first rendering! onInit() is used for that one!).
		 * @memberOf hcm.fab.mytimesheet.view.view.EditAssignment
		 */
		//	onBeforeRendering: function() {
		//
		//	},

		/**
		 * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
		 * This hook is the same one that SAPUI5 controls get after being rendered.
		 * @memberOf hcm.fab.mytimesheet.view.view.EditAssignment
		 */
		//	onAfterRendering: function() {
		//
		//	},

		/**
		 * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
		 * @memberOf hcm.fab.mytimesheet.view.view.EditAssignment
		 */
		//	onExit: function() {
		//
		//	}

	});

});