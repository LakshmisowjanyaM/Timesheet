/*
 * Copyright (C) 2009-2020 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global location*/
sap.ui.define([
	"hcm/fab/mytimesheet/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"hcm/fab/mytimesheet/model/formatter",
	'sap/m/MessagePopover',
	'sap/m/MessagePopoverItem',
], function(
	BaseController,
	JSONModel,
	History,
	formatter,
	MessagePopover,
	MessagePopoverItem
) {
	"use strict";

	return BaseController.extend("hcm.fab.mytimesheet.controller.Object", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function() {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0
				});
			this._nCounter = 0;
			var oModel = this.getGlobalModel("ProfileFields");
			var oControl = this.getGlobalModel("controls");
			this.busyDialog = new sap.m.BusyDialog();
			var oEditModel = this.getGlobalModel("EditedTask");
			// this.setModel(oControl, "controls");
			this.setModel(oEditModel, "EditedTask");
			this.oRouter = this.getRouter();
			var oPernr = this.getPernr();
			if (!oPernr) {
				this.oRouter.navTo("worklist", {}, true);
			} else {
				this.empID = oPernr.getData();
			}
			this.oDataModel = this.getOwnerComponent().getModel();
			this.oBundle = this.getResourceBundle();
			this.oRouter.getRoute("createAssignment").attachMatched(this._onObjectMatched.bind(this), this);
			var oModel = new JSONModel({
				reloadTasks: false
			});
			this.setGlobalModel(oModel, "TaskReload");
			// this.setModel(oModel,"ProfileFields");
			// this.getRouter().getRoute("createAssignment").attachPatternMatched(this._onObjectMatched, this);

			// // Store original busy indicator delay, so it can be restored later on
			// iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			// this.setModel(oViewModel, "objectView");
			// this.getOwnerComponent().getModel().metadataLoaded().then(function () {
			// 		// Restore original busy indicator delay for the object view
			// 		oViewModel.setProperty("/delay", iOriginalBusyDelay);
			// 	}
			// );
		},
		onNavButton: function() {
			this.getRouter().navTo("worklist", {}, true);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function() {
			var oViewModel = this.getModel("objectView"),
				oShareDialog = sap.ui.getCore().createComponent({
					name: "sap.collaboration.components.fiori.sharing.dialog",
					settings: {
						object: {
							id: location.href,
							share: oViewModel.getProperty("/shareOnJamTitle")
						}
					}
				});
			oShareDialog.open();
		},
		onEditAssignment: function() {
			var oControl = this.getModel("controls");
			oControl.setProperty('/assignmentTitle', this.oBundle.getText("editAssignment"));
			oControl.setProperty('/displayAssignment', false);
			oControl.setProperty('/displayAssignmentCancel', true);
			// this.setModel(oControl, "controls");
			// this.setGlobalModel(oControl, "controls");
		},
		onDisplayCancel: function() {
			var oControl = this.getModel("controls");
			oControl.setProperty('/assignmentTitle', this.oBundle.getText("displayAssignment"));
			oControl.setProperty('/displayAssignment', true);
			oControl.setProperty('/displayAssignmentCancel', false);
			// this.setModel(oControl, "controls");
			// this.setGlobalModel(oControl, "controls");
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			// var sObjectId = oEvent.getParameter("arguments").objectId;
			// this.getModel().metadataLoaded().then(function() {
			// 	var sObjectPath = this.getModel().createKey("ConfigurationSet", {
			// 		Pernr: sObjectId
			// 	});
			// 	this._bindView("/" + sObjectPath);
			// }.bind(this));
			var oModel = this.getGlobalModel("ProfileFields");
			var oControl = this.getGlobalModel("controls");
			var oEditModel = this.getGlobalModel("EditedTask");
			this.setModel(oControl, "controls");
			this.setModel(oEditModel, "EditedTask");
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function(sObjectPath) {
			var oViewModel = this.getModel("objectView"),
				oDataModel = this.getModel();

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oDataModel.metadataLoaded().then(function() {
							// Busy indicator on view should only be set if metadata is loaded,
							// otherwise there may be two busy indications next to each other on the
							// screen. This happens because route matched handler already calls '_bindView'
							// while metadata is loaded.
							oViewModel.setProperty("/busy", true);
						});
					},
					dataReceived: function() {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},
		showBusy: function() {
			this._nCounter++;
			if (this._nCounter === 1) {
				this.busyDialog.open();
			}
		},
		hideBusy: function(forceHide) {
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

		_onBindingChange: function() {
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
		onNavBack: function() {
			this.byId("dynamicPageId").destroy();
			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			// this._deleteUnsavedRecord();

			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				history.go(-1);
			} else {
				oCrossAppNavigator.toExternal({
					target: {
						shellHash: "#Shell-home"
					}
				});
			}
		    // this.getRouter().navTo("worklist", {}, true);
		},
		onBack: function(){
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oModel = new JSONModel();
			var data = [];
			oModel.setData(data);
			this.setModel(oModel, "EditedTask");
			this.setModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "EditedTask");
			this.getRouter().navTo("worklist", {}, true);			
		},
		onCancel: function() {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oModel = new JSONModel();
			var data = [];
			oModel.setData(data);
			this.setModel(oModel, "EditedTask");
			this.setModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "EditedTask");
			this.getRouter().navTo("worklist", {}, true);
		},
		onValueHelp: function(oEvent) {
			var that = this;
			var FieldName = oEvent.getSource().getCustomData('FieldName')[0].getValue();
			var FieldLabel = oEvent.getSource().getCustomData('FieldLabel')[2].getValue();
			var oControl = this.getModel("controls");
			oControl.setProperty("/fieldLabel", FieldLabel);
			this.setModel(oControl, "controls");
			new Promise(
				function(fnResolve, fnReject) {
					that.getValueHelpCollection(FieldName, oEvent.getSource());
					fnResolve(
						// that.valueHelpFragment(oEvent.getSource())
					);
					fnReject();
				}
			);
		},
		// valueHelpFragment: function(oSource) {
		// 	var that = this;
		// 	var oView = this.getView();
		// 	this.oValueHelpSource = oSource;
		// 	// create dialog lazily
		// 	var oDialog;
		// 	// if (!oDialog) {
		// 	var oDialogController = {
		// 		handleConfirm: that.handleClick.bind(this),
		// 		handleCancel: function(oEvent) {
		// 			// oDialog.close();
		// 			oDialog.destroy();
		// 			var data = [];
		// 			var oModel = new JSONModel(data);
		// 			that.setModel(oModel, "ValueHelp");
		// 		}.bind(that),
		// 		handleClickValueHelp: that.handleClick.bind(that)
		// 	};
		// 	// create dialog via fragment factory
		// 	oDialog = sap.ui.xmlfragment(oView.getId(), "hcm.fab.mytimesheet.view.fragments.ValueHelp", oDialogController);
		// 	// connect dialog to view (models, lifecycle)
		// 	oView.addDependent(oDialog);
		// 	// }
		// 	jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oDialog);

		// 	jQuery.sap.delayedCall(0, this, function() {
		// 		oDialog.open();
		// 	});
		// },
		valueHelpFragment: function(oSource) {
			var that = this;
			var oView = this.getView();
			this.oValueHelpSource = oSource;
			// create dialog lazily
			var oDialog;
			// if (!oDialog) {
			var oDialogController = {
				handleConfirm: that.handleClick.bind(this),
				handleCancel: function(oEvent) {
					oDialog.close();
					// oDialog.destroy();
					var data = [];
					var oModel = new JSONModel(data);
					that.setModel(oModel, "ValueHelp");
				}.bind(that),
				handleBeforeOpen: function(oEvent) {
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
				handleAfterOpen: function(oEvent) {
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

						oTable.bindAggregation("items", "/", function(sId, oContext) {
							var aCols = oTable.getModel("columns").getData().cols;

							return new sap.m.ColumnListItem({
								cells: aCols.map(function(column) {
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
						search: function() {

						}
					});

					if (oFilterBar.setBasicSearch) {
						oFilterBar.setBasicSearch(new sap.m.SearchField({
							showSearchButton: sap.ui.Device.system.phone,
							placeholder: "Search",
							search: function(event) {
								oEvent.getSource().getFilterBar().search();
							}
						}));
					}

					oEvent.getSource().setFilterBar(oFilterBar);
					oEvent.getSource().update();
				},
				handleAfterClose: function(oEvent) {
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

			jQuery.sap.delayedCall(0, this, function() {
				oDialog.open();
			});
		},

		getValueHelpCollection: function(FieldName, oSource) {
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
			// f.push(a);
			// f.push(b);
			f.push(c);
			f.push(d);
			var mParameters = {
				urlParameters: '$expand=ValueHelpHits',
				filters: f,
				success: function(oData, oResponse) {
					that.results = oData.results[0].ValueHelpHits.results;
					oModel.setData(that.results);
					that.setModel(oModel, "ValueHelpHits");
					orgModel.setData(oData.results[0]);
					that.setModel(orgModel, "ValueHelp");
					that.hideBusy(true);
					that.valueHelpFragment(oSource);
				},
				error: function(oError) {
					that.hideBusy(true);
				}
			};
			this.oDataModel.read('/ValueHelpCollection', mParameters);
		},
		handleClick: function(oEvent) {
			var value = oEvent.getParameter('tokens');
			// this.oValueHelpSource.setTokens(value);
			this.oValueHelpSource.setValue(value[0].getKey());
			oEvent.getSource().close();
		},
		onSave: function(oEvent) {
			var oControl = this.getModel("controls");
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
					PEDD: "",
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
					SPLIT: 0,
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
			if (oControl.getProperty("/editAssignment")) {
				TaskData.AssignmentOperation = "U";
				for (var i = 0; i < this.byId('EDITFORM_FIELDS').getFormElements().length; i++) {
					if (this.byId("EDITFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue() == "AssignmentName") {
						TaskData[this.byId("EDITFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this.byId(
							'EDITFORM_FIELDS').getFormElements()[i].getFields()[0].getValue();
					} else if (this.byId("EDITFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue() == "ApproverName") {
						TaskData[this.byId("EDITFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this
							.byId(
								'EDITFORM_FIELDS').getFormElements()[i].getFields()[0].getValue();
					} else if (this.byId(
							"EDITFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue() == "AssignmentStatus") {

						TaskData[this.byId("EDITFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this
							.byId(
								'EDITFORM_FIELDS').getFormElements()[i].getFields()[1].getState() ? "1" : "";
					} else {
						TaskData.AssignmentFields[this.byId("EDITFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this
							.byId(
								'EDITFORM_FIELDS').getFormElements()[i].getFields()[0].getValue();
					}
				}
				TaskData.AssignmentId = this.byId("EDITFORM_FIELDS").getFormElements()[0].getFields()[0].getCustomData()[1].getValue();
				this.UpdateTask(TaskData);
			} else if (oControl.getProperty("/createAssignment")) {
				for (var i = 0; i < this.byId('FORM_FIELDS').getFormElements().length; i++) {

					if (this.byId("FORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue() == "AssignmentName") {
						TaskData[this.byId("FORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this.byId(
							'FORM_FIELDS').getFormElements()[i].getFields()[0].getValue();
					} else if (this.byId("FORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue() == "ApproverName") {
						TaskData[this.byId("FORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this
							.byId(
								'FORM_FIELDS').getFormElements()[i].getFields()[0].getValue();
					} else if (this.byId(
							"FORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue() == "AssignmentStatus") {

						TaskData[this.byId("FORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this
							.byId(
								'FORM_FIELDS').getFormElements()[i].getFields()[1].getState() ? "1" : "";
					} else {
						TaskData.AssignmentFields[this.byId("FORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this
							.byId(
								'FORM_FIELDS').getFormElements()[i].getFields()[0].getValue();
					}
				}
				this.SubmitTask(TaskData);

			} else if (oControl.getProperty("/copyAssignment")) {
				for (var i = 0; i < this.byId('COPYFORM_FIELDS').getFormElements().length; i++) {

					if (this.byId("COPYFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue() == "AssignmentName") {
						TaskData[this.byId("COPYFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this.byId(
							'COPYFORM_FIELDS').getFormElements()[i].getFields()[0].getValue();
					} else if (this.byId("COPYFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue() == "ApproverName") {
						TaskData[this.byId("COPYFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this
							.byId(
								'COPYFORM_FIELDS').getFormElements()[i].getFields()[0].getValue();
					} else if (this.byId(
							"COPYFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue() == "AssignmentStatus") {

						TaskData[this.byId("COPYFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this
							.byId(
								'COPYFORM_FIELDS').getFormElements()[i].getFields()[1].getState() ? "1" : "";
					} else {
						TaskData.AssignmentFields[this.byId("COPYFORM_FIELDS").getFormElements()[i].getFields()[0].getCustomData()[0].getValue()] = this
							.byId(
								'COPYFORM_FIELDS').getFormElements()[i].getFields()[0].getValue();
					}
				}
				this.SubmitTask(TaskData);
			}

		},
		SubmitTask: function(TaskData) {
			var that = this;
			var oModel = new JSONModel();
			var mParameters = {
				success: function(oData, oResponse) {
					var data = oData.results;
					var toastMsg = that.oBundle.getText("taskSaved");
					sap.m.MessageToast.show(toastMsg, {
						duration: 1000
					});
					// that.getTasks();
					// var data = {
					// 	reloadTasks: true
					// };
					var data = that.getGlobalModel("TaskReload").getData();
					data.reloadTasks = true;
					that.setGlobalModel(new JSONModel(data), "TaskReload");
					that.oRouter.navTo("worklist", {}, true);
				},
				error: function(oError) {
					var error = oError;
					var toastMsg = that.oBundle.getText("error");
					sap.m.MessageToast.show(toastMsg, {
						duration: 1000
					});
				}
			};
			this.oDataModel.create('/AssignmentCollection', TaskData, mParameters);
			// this.oDataModel.submitChanges();
		},
		handleMessagePopover: function(oEvent) {
			var oMessageTemplate = new MessagePopoverItem({
				type: '{message>severity}',
				description: "{message>description}",
				title: '{message>message}',
				subtitle: "{message>additionalText}"
			});
			var oMessagePopover = new MessagePopover({
				items: {
					path: "message>/",
					template: oMessageTemplate
				}
			});
			oMessagePopover.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
			oMessagePopover.toggle(oEvent.getSource());

		},
		UpdateTask: function(TaskData) {
			var that = this;
			var oModel = new JSONModel();
			var mParameters = {
				success: function(oData, oResponse) {
					var data = that.getGlobalModel("TaskReload").getData();
					data.reloadTasks = true;
					that.setGlobalModel(new JSONModel(data), "TaskReload");
					that.oRouter.navTo("worklist", {}, true);
				},
				error: function(oError) {
					var error = oError;
				}
			};
			this.oDataModel.create('/AssignmentCollection', TaskData, mParameters);
		},
		onExit: function() {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oModel = new JSONModel();
			var data = [];
			oModel.setData(data);
			this.setModel(oModel, "EditedTask");
			this.setModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "DisplayTask");
			this.setGlobalModel(oModel, "EditedTask");
		},

	});

});