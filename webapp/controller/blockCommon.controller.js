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
	"sap/m/Text",
	'hcm/fab/mytimesheet/model/models',
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",

], function (BaseController, JSONModel, formatter, MessagePopover, History, Dialog, Text, models, Filter, FilterOperator) {
	"use strict";
	return BaseController.extend("hcm.fab.mytimesheet.controller.blockCommon", {
		formatter: formatter,
		onInit: function () {
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0
				});
			this._nCounter = 0;
			// this.oComponent = models.getoComponent();
			// this.oBundle = this.getResourceBundle();
			// var oModel = this.getGlobalModel("ProfileFields");
			// var oControl = this.getGlobalModel("controls");
			// this.oControl = oControl;
			this.busyDialog = new sap.m.BusyDialog();
			// this.oFormatYyyymmdd = sap.ui.core.format.DateFormat.getInstance({
			// 	pattern: "yyyy-MM-dd",
			// 	calendarType: sap.ui.core.CalendarType.Gregorian
			// });
			// // var oEditModel = this.getGlobalModel("EditedTask");
			// // this.setModel(oControl, "controls");
			// // this.setModel(oEditModel, "EditedTask");
			// this.oRouter = models.getoRouter();
			// var oModel = this.getModel("createGroup");
			// this.setModel(oModel, "createGroup");
			var oPernr = this.getInitPernr();
			if (oPernr) {
				this.empID = oPernr;
				this.oDataModel = this.getoDataModel();
				// this.oBundle = this.getResourceBundle();
				this.oBundle = this.getoBundle();
			}
			// this.oDataModel = this.getOwnerComponent().getModel();

		},
		init: function (oData, oText) {
			// oDataModel = oData;
			// oBundle = oText;
			// this.oDataModel = oDataModel;
			// this.oBundle = oText;
		},
		onAfterRendering: function () {
			// this.oDataModel = this.getOwnerComponent().getModel();
			// this.oBundle = this.getResourceBundle();
			// var oPernr = this.getPernr();
			// this.oRouter = this.getRouter();
			// this.oDataModel = models.getoDataModel();
			// this.oBundle = this.getResourceBundle();
			// this.oBundle = models.getoBundle();
			this.oDataModel = this.getoDataModel();
			this.oBundle = this.getoBundle();
			var oPernr = this.getInitPernr();
			this.empID = oPernr;
			if (this.byId("focusEditformHeader") !== undefined) {
				this.byId("focusEditformHeader").focus();
			}
			// var oModel = this.getModel("createGroup");
			// this.setModel(oModel, "createGroup");
			try {
				//sap.ui.getCore().getModel("thisModel1").getData().fireHeader();
				this.getGlobalModel("thisModel").getData().fireHeader();
				//console.log("success");
			} catch (exception) {
				//console.log("fail");

			}

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
		onValueHelp: function (oEvent) {
			var that = this;
			var FieldName = oEvent.getSource().getCustomData('FieldName')[0].getValue();
			that.FieldName = FieldName;
			var FieldLabel = oEvent.getSource().getCustomData('FieldLabel')[2].getValue();
			var oControl = this.getModel("controls");
			if (oEvent.getSource().getId().indexOf("EDITFORM") > 0) {
				that.RelatedFieldName = FieldName;
				that.RelatedValueSource = oEvent.getSource();
				oControl.setProperty("/fieldLabel", FieldLabel);
			} else {
				oControl.setProperty("/fieldLabel1", FieldLabel);
			}
			if (that.RelatedFieldName != that.FieldName) {
				that.selectionField1Val = "";
				that.selectionField2val = "";
				that.selectionField3Val = "";
				that.selectionField4Val = "";
				that.selectionField5Val = "";
				that.selectionField6Val = "";
			}
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
			//			if(oSource._oValueHelpIcon.getId().indexOf("EDITFORM") > 0){ 
			if (oSource.getId().indexOf("EDITFORM") > 0) {
				var that = this;
				var oView = this.getView();
				that.oDialog = oView.byId("oValueHelpDialog");
				this.oValueHelpSource = oSource;
				// create dialog lazily
				if (!that.oDialog) {
					that.oDialogController = {
						handleConfirm: that.handleClick.bind(this),
						handleCancel: function (oEvent) {
							that.oDialog.close();
							var data = [];
							var oModel = new JSONModel(data);
							that.setModel(oModel, "ValueHelp");
						}.bind(that),
						handleBeforeOpen: function (oEvent) {
							var title = oEvent.getSource().getTitle();
							oEvent.getSource().setTitle(title + ' | ' + that.oBundle.getText("maxHitsValue") + " = " + "150 " + '(' + that.oBundle.getText(
								"changeInAdvancedSearch") + ' )');
						},
						handleAfterOpen: function (oEvent) {

							var oModel = new JSONModel();

							if (sap.ui.Device.system.phone) {
								oEvent.getSource().getTable().setNoDataText(that.oBundle.getText('assignmentNoData'));
							} else {
								oEvent.getSource().getTable().setNoData(that.oBundle.getText('assignmentNoData'));
							}

							if (that.getModel("ValueHelpHits") && that.getModel("ValueHelp")) {
								var data = that.getModel("ValueHelpHits").getData();
								var seldata = that.getModel("ValueHelp").getData();
								var columns = [];
								that.oValueTable = oEvent.getSource().getTable();
								if (seldata.FieldName === "APPROVER") {
									data[0].DispField2Header = that.oBundle.getText('approverName');
									columns.push({
										label: seldata.DispField1Text + "(" + that.oBundle.getText("key") + ")",
										template: "DispField1Val"
									});
								} else {
									columns.push({
										label: seldata.DispField1Text + "(" + that.oBundle.getText("key") + ")",
										template: "DispField1Id"
									});
								}
								if ((data[1].DispField1Header && data[1].DispField1Header !== "") || (data[1].DispField1Val && data[1].DispField1Val !== "")) {
									that.DispField1Header = data[1].DispField1Header;
									columns.push({
										label: seldata.DispField2Text,
										template: "DispField1Val"
									});
								}
								if ((data[1].DispField2Header && data[1].DispField2Header !== "") || (data[1].DispField2Val && data[1].DispField2Val !== "")) {
									columns.push({
										label: seldata.DispField3Text,
										template: "DispField2Val"
									});
								}
								if ((data[1].DispField3Header && data[1].DispField3Header !== "") || (data[1].DispField3Val && data[1].DispField3Val !== "")) {
									columns.push({
										label: seldata.DispField4Text,
										template: "DispField3Val"
									});
								}
								if ((data[1].DispField4Header && data[1].DispField4Header !== "") || (data[1].DispField4Val && data[1].DispField4Val !== "")) {
									columns.push({
										label: data[1].DispField4Header,
										template: "DispField4Val"
									});
								}
								if ((data[1].DispField5Header && data[1].DispField5Header !== "") || (data[1].DispField5Val && data[1].DispField5Val !== "")) {
									columns.push({
										label: data[1].DispField5Header,
										template: "DispField5Val"
									});
								}
								if ((data[1].DispField6Header && data[1].DispField6Header !== "") || (data[1].DispField6Val && data[1].DispField6Val !== "")) {
									columns.push({
										label: data[1].DispField6Header,
										template: "DispField6Val"
									});
								}

								if (seldata.FieldName === "APPROVER") {
									data[0].DispField1Header = that.oBundle.getText('approverName');
									that.DispField1Header = data[0].DispField1Header;
								}
								var cols = {
									cols: columns
								};
								oModel.setData(cols);
								oEvent.getSource().getTable().setModel(oModel, "columns");
								if (seldata.FieldName === "APPROVER") {
									oEvent.getSource().setKey("DispField1Val");
									oEvent.getSource().setDescriptionKey("DispField2Val");
								} else {
									oEvent.getSource().setKey("DispField1Id");
									oEvent.getSource().setDescriptionKey("DispField1Val");
								}
								var oRowsModel = new sap.ui.model.json.JSONModel();
								oRowsModel.setData(data);
								oRowsModel.getData().splice(0, 1);
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
								if (that.oValueHelpSource.getProperty("value")) {
									oEvent.getSource().addButton(new sap.m.Button({
										text: that.oBundle.getText("clearSelection"),
										press: function (oEvent) {
											that.oValueHelpSource.setValue("");
											oEvent.getSource().getParent().close();
										}
									}));
								}
								var filter = [];
								//Adding maximum hits input box
								filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
									groupTitle: "searchFields",
									groupName: "Assignment",
									name: "MaxHits",
									label: that.oBundle.getText("maxHits"),
									labelTooltip: that.oBundle.getText("maxHitsDefault"),
									control: new sap.m.Input({
										placeholder: that.oBundle.getText("maxHitsDefault")

									}),
									controlTooltip: that.oBundle.getText("maxHitsDefault")
								}));
								if (seldata.SelField1Text && seldata.SelField1Text !== "") {
									var oCustomField = new sap.ui.core.CustomData({
										key: "FieldName",
										value: seldata.SelField1Name
									});
									var oCustomassign = new sap.ui.core.CustomData({
										key: "AssignmentId",
										value: ""
									});
									var oCustomLabel = new sap.ui.core.CustomData({
										key: "FieldLabel",
										value: seldata.SelField1Text
									});
									filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
										groupTitle: "searchFields",
										groupName: "Assignment",
										name: seldata.SelField1Name,
										label: seldata.SelField1Text + "(" + that.oBundle.getText("key") + ")",
										control: new sap.m.Input({
											showValueHelp: seldata.SelField1F4 === "X" ? true : false,
											customData: [oCustomField, oCustomassign, oCustomLabel],
											valueHelpRequest: that.onValueHelp.bind(that)
										})
									}));
									that.selectionField1 = seldata.SelField1Name;
									that.retField1 = seldata.SelField1Name;
								}
								if (seldata.SelField2Text && seldata.SelField2Text !== "") {
									if (seldata.SelField2Text !== seldata.SelField1Text) {
										var oCustomField = new sap.ui.core.CustomData({
											key: "FieldName",
											value: seldata.SelField2Name
										});
										var oCustomassign = new sap.ui.core.CustomData({
											key: "AssignmentId",
											value: ""
										});
										var oCustomLabel = new sap.ui.core.CustomData({
											key: "FieldLabel",
											value: seldata.SelField2Text
										});
										filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
											groupTitle: "searchFields",
											groupName: "Assignment",
											name: seldata.SelField2Name,
											label: seldata.SelField2Text,
											control: new sap.m.Input({
												showValueHelp: seldata.SelField2F4 === "X" ? true : false,
												customData: [oCustomField, oCustomassign, oCustomLabel],
												valueHelpRequest: that.onValueHelp.bind(that)
											})
										}));
										that.selectionField2 = seldata.SelField2Name;
										that.retField2 = seldata.SelField2Name;
									}
								}
								if (seldata.SelField3Text && seldata.SelField3Text !== "") {
									if ((seldata.SelField3Text !== seldata.SelField2Text) && (seldata.SelField3Text !== seldata.SelField1Text)) {
										var oCustomField = new sap.ui.core.CustomData({
											key: "FieldName",
											value: seldata.SelField3Name
										});
										var oCustomassign = new sap.ui.core.CustomData({
											key: "AssignmentId",
											value: ""
										});
										var oCustomLabel = new sap.ui.core.CustomData({
											key: "FieldLabel",
											value: seldata.SelField3Text
										});
										filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
											groupTitle: "searchFields",
											groupName: "Assignment",
											name: seldata.SelField3Name,
											label: seldata.SelField3Text,
											control: new sap.m.Input({
												showValueHelp: seldata.SelField3F4 === "X" ? true : false,
												customData: [oCustomField, oCustomassign, oCustomLabel],
												valueHelpRequest: that.onValueHelp.bind(that)
											})
										}));
										that.selectionField3 = seldata.SelField3Name;
										that.retField3 = seldata.SelField3Name;
									}
								}
								if (seldata.SelField4Text && seldata.SelField4Text !== "") {
									if ((seldata.SelField4Text !== seldata.SelField3Text) && (seldata.SelField4Text !== seldata.SelField2Text) && (seldata.SelField4Text !==
											seldata.SelField1Text)) {
										var oCustomField = new sap.ui.core.CustomData({
											key: "FieldName",
											value: seldata.SelField4Name
										});
										var oCustomassign = new sap.ui.core.CustomData({
											key: "AssignmentId",
											value: ""
										});
										var oCustomLabel = new sap.ui.core.CustomData({
											key: "FieldLabel",
											value: seldata.SelField4Text
										});
										filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
											groupTitle: "searchFields",
											groupName: "Assignment",
											name: seldata.SelField4Name,
											label: seldata.SelField4Text,
											control: new sap.m.Input({
												showValueHelp: seldata.SelField4F4 === "X" ? true : false,
												customData: [oCustomField, oCustomassign, oCustomLabel],
												valueHelpRequest: that.onValueHelp.bind(that)
											})
										}));
										that.selectionField4 = seldata.SelField4Name;
										that.retField4 = seldata.SelField4Name;
									}
								}
								if (seldata.SelField5Text && seldata.SelField5Text !== "") {
									if ((seldata.SelField5Text !== seldata.SelField4Text) && (seldata.SelField5Text !== seldata.SelField3Text) && (seldata.SelField5Text !==
											seldata.SelField2Text) && (seldata.SelField5Text !== seldata.SelField1Text)) {
										var oCustomField = new sap.ui.core.CustomData({
											key: "FieldName",
											value: seldata.SelField5Name
										});
										var oCustomassign = new sap.ui.core.CustomData({
											key: "AssignmentId",
											value: ""
										});
										var oCustomLabel = new sap.ui.core.CustomData({
											key: "FieldLabel",
											value: seldata.SelField5Text
										});
										filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
											groupTitle: "searchFields",
											groupName: "Assignment",
											name: seldata.SelField5Name,
											label: seldata.SelField5Text,
											control: new sap.m.Input({
												showValueHelp: seldata.SelField5F4 === "X" ? true : false,
												customData: [oCustomField, oCustomassign, oCustomLabel],
												valueHelpRequest: that.onValueHelp.bind(that)
											})
										}));
										that.selectionField5 = seldata.SelField5Name;
										that.retField5 = seldata.SelField5Name;
									}
								}
								if (seldata.SelField6Text && seldata.SelField6Text !== "") {
									if ((seldata.SelField6Text !== seldata.SelField5Text) && (seldata.SelField6Text !== seldata.SelField4Text) && (seldata.SelField6Text !==
											seldata.SelField3Text) && (seldata.SelField6Text !== seldata.SelField2Text) && (seldata.SelField6Text !== seldata.SelField1Text)) {
										var oCustomField = new sap.ui.core.CustomData({
											key: "FieldName",
											value: seldata.SelField6Name
										});
										var oCustomassign = new sap.ui.core.CustomData({
											key: "AssignmentId",
											value: ""
										});
										var oCustomLabel = new sap.ui.core.CustomData({
											key: "FieldLabel",
											value: seldata.SelField6Text
										});
										filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
											groupTitle: "searchFields",
											groupName: "Assignment",
											name: seldata.SelField6Name,
											label: seldata.SelField6Text,
											control: new sap.m.Input({
												showValueHelp: seldata.SelField6F4 === "X" ? true : false,
												customData: [oCustomField, oCustomassign, oCustomLabel],
												valueHelpRequest: that.onValueHelp.bind(that)
											})
										}));
										that.selectionField6 = seldata.SelField6Name;
										that.retField6 = seldata.SelField6Name;
									}
								}

								var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
									advancedMode: true,
									filterBarExpanded: false,
									showGoOnFB: !sap.ui.Device.system.phone,
									filterGroupItems: filter,
									search: function (event) {
										if (that.oFilterBar._oBasicSearchField === null || that.oFilterBar._oBasicSearchField === undefined) {
											var basicSearchString = "";
										} else {
											basicSearchString = that.oFilterBar._oBasicSearchField.getProperty("value");
											if (basicSearchString) {
												basicSearchString = "*" + basicSearchString + "*";
											}
										}
										if (event.getParameters().selectionSet[0]) {
											that.MaxHits = event.getParameters().selectionSet[0].getValue();
										}
										if (event.getParameters().selectionSet[1]) {
											that.selectionField1Val = event.getParameters().selectionSet[1].getValue();
											that.selectionField1Val = "*" + that.selectionField1Val + "*";
										}
										if (event.getParameters().selectionSet[2]) {
											that.selectionField2Val = event.getParameters().selectionSet[2].getValue();
											that.selectionField2Val = "*" + that.selectionField2Val + "*";
										}
										if (event.getParameters().selectionSet[3]) {
											that.selectionField3Val = event.getParameters().selectionSet[3].getValue();
											that.selectionField3Val = "*" + that.selectionField3Val + "*";
										}
										if (event.getParameters().selectionSet[4]) {
											that.selectionField4Val = event.getParameters().selectionSet[4].getValue();
											that.selectionField4Val = "*" + that.selectionField4Val + "*";
										}
										if (event.getParameters().selectionSet[5]) {
											that.selectionField5Val = event.getParameters().selectionSet[5].getValue();
											that.selectionField5Val = "*" + that.selectionField5Val + "*";
										}
										if (event.getParameters().selectionSet[6]) {
											that.selectionField6Val = event.getParameters().selectionSet[6].getValue();
											that.selectionField6Val = "*" + that.selectionField6Val + "*";
										}

										if (that.RelatedFieldName) {
											that.FieldName = that.RelatedFieldName;
										}
										that.getValueHelpCollection(that.FieldName, that.SourceField, {
											fieldName: "FieldValue",
											operation: sap.ui.model.FilterOperator.EQ,
											value: basicSearchString
										});
									}
								});
								if (oFilterBar.setBasicSearch) {
									if (that.DispField1Header && that.DispField1Header !== "") {
										oFilterBar.setBasicSearch(new sap.m.SearchField({
											showSearchButton: sap.ui.Device.system.phone,
											placeholder: that.oBundle.getText('searchWithField', [that.DispField1Header]),
											search: function (event) {
												var oFilter = [];
												var selectedKey = event.getParameter('query');
												if (selectedKey) {
													selectedKey = "*" + selectedKey + "*";
												}
												var FilterOperator = sap.ui.model.FilterOperator.Contains;
												oFilter.push(new sap.ui.model.Filter("DispField1Val", FilterOperator, selectedKey));
												if (that.FieldName === 'APPROVER') {
													that.getValueHelpCollection(that.FieldName, that.SourceField, {
														fieldName: "FieldValue",
														operation: sap.ui.model.FilterOperator.EQ,
														value: selectedKey
													});
												} else {
													// invoking search to get valid results from backend
													that.getValueHelpCollection(that.FieldName, that.SourceField, {
														fieldName: "FieldValue",
														operation: sap.ui.model.FilterOperator.EQ,
														value: selectedKey
													});
												}
											}
										}));
									} else {
										oFilterBar.setBasicSearch(new sap.m.SearchField({
											showSearchButton: sap.ui.Device.system.phone,
											placeholder: that.oBundle.getText('searchWithKey'),
											search: function (event) {
												var oFilter = [];
												var selectedKey = event.getParameter('query');
												var FilterOperator = sap.ui.model.FilterOperator.Contains;
												oFilter.push(new sap.ui.model.Filter("DispField1Id", FilterOperator, selectedKey));
												that.oValueTable.getBinding('rows').filter(oFilter);
											}
										}));
									}

								}
								that.oFilterBar = oFilterBar;
								oEvent.getSource().setFilterBar(oFilterBar);
								oEvent.getSource().update();
							}
						},
						handleAfterClose: function (oEvent) {
							that.oDialog.destroy();
							that.selectionField1Val = "";
							that.selectionField2Val = "";
							that.selectionField3Val = "";
							that.selectionField4Val = "";
							that.selectionField5Val = "";
							that.selectionField6Val = "";

						},
						handleClickValueHelp: that.handleClick.bind(that)
					};
					// create dialog via fragment factory
					that.oDialog = sap.ui.xmlfragment(oView.getId(), "hcm.fab.mytimesheet.view.fragments.ValueHelpDialog", that.oDialogController);
					// connect dialog to view (models, lifecycle)
					oView.addDependent(that.oDialog);
				}
				jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), that.oDialog);
				that.oDialog.open();
			} else {
				var that = this;
				this.oValueHelpSource = oSource;
				var oView = this.getView();
				that.oDialogController1 = {
					handleConfirm1: that.handleClick.bind(this),
					handleCancel1: function (oEvent) {
						that.oDialog1.close();
					}.bind(that),
					handleBeforeOpen1: function (oEvent) {},
					handleAfterOpen1: function (oEvent) {
						// var oTable = oEvent.getSource().getTable();
						var oModel1 = new JSONModel();
						var data1 = that.getModel("ValueHelpHits").getData();
						var seldata1 = that.getModel("ValueHelp").getData();
						var columns = [];
						that.oValueTable1 = oEvent.getSource().getTable();
						// for(var i=0;i<data.length;i++){
						columns.push({
							label: seldata1.SelField1Text + "(" + that.oBundle.getText("key") + ")",
							template: "DispField1Id"
						});
						if (data1[1].DispField1Header && data1[1].DispField1Header !== "" || (data1[1].DispField1Val && data1[1].DispField1Val !== "")) {
							columns.push({
								label: seldata1.SelField2Text,
								template: "DispField1Val"
							});
						}
						if (data1[1].DispField2Header && data1[1].DispField2Header !== "" || (data1[1].DispField2Val && data1[1].DispField2Val !== "")) {
							columns.push({
								label: seldata1.SelField3Text,
								template: "DispField2Val"
							});
						}
						if (data1[1].DispField3Header && data1[1].DispField3Header !== "" || (data1[1].DispField3Val && data1[1].DispField3Val !== "")) {
							columns.push({
								label: seldata1.SelField4Text,
								template: "DispField3Val"
							});
						}
						if (data1[1].DispField4Header && data1[1].DispField4Header !== "" || (data1[1].DispField4Val && data1[1].DispField4Val !== "")) {
							columns.push({
								label: data1[1].DispField4Header,
								template: "DispField4Val"
							});
						}
						if (data1[1].DispField5Header && data1[1].DispField5Header !== "" || (data1[1].DispField5Val && data1[1].DispField5Val !== "")) {
							columns.push({
								label: data1[1].DispField5Header,
								template: "DispField5Val"
							});
						}
						if (data1[1].DispField6Header && data1[1].DispField6Header !== "" || (data1[1].DispField6Val && data1[1].DispField6Val !== "")) {
							columns.push({
								label: data1[1].DispField6Header,
								template: "DispField6Val"
							});
						}

						// }
						var cols = {
							cols: columns
						};
						oModel1.setData(cols);
						oEvent.getSource().getTable().setModel(oModel1, "columns");
						oEvent.getSource().setKey("DispField1Id");
						oEvent.getSource().setDescriptionKey("DispField1Val");
						var oRowsModel1 = new sap.ui.model.json.JSONModel();
						oRowsModel1.setData(data1);
						oRowsModel1.getData().splice(0, 1);
						oEvent.getSource().getTable().setModel(oRowsModel1);
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
						var filter = [];
						//Adding maximum hits input box
						filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
							groupTitle: "searchFields",
							groupName: "Assignment",
							name: "MaxHits",
							label: that.oBundle.getText("maxHits"),
							labelTooltip: that.oBundle.getText("maxHitsDefault"),
							control: new sap.m.Input({
								placeholder: that.oBundle.getText("maxHitsDefault")

							}),
							controlTooltip: that.oBundle.getText("maxHitsDefault")
						}));
						if (seldata1.SelField1Text && seldata1.SelField1Text !== "") {
							var oCustomField = new sap.ui.core.CustomData({
								key: "FieldName",
								value: seldata1.SelField1Name
							});
							var oCustomassign = new sap.ui.core.CustomData({
								key: "AssignmentId",
								value: ""
							});
							var oCustomLabel = new sap.ui.core.CustomData({
								key: "FieldLabel",
								value: seldata1.SelField1Text
							});
							filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
								groupTitle: "searchFields",
								groupName: "Assignment",
								name: seldata1.SelField1Name,
								label: seldata1.SelField1Text + "(" + that.oBundle.getText("key") + ")",
								control: new sap.m.Input({
									customData: [oCustomField, oCustomassign, oCustomLabel],
									valueHelpRequest: that.onValueHelp.bind(that)
								})
							}));
							that.selectionField1 = seldata1.SelField1Name;
						}
						if (seldata1.SelField2Text && seldata1.SelField2Text !== "") {
							if (seldata1.SelField2Text !== seldata1.SelField1Text) {
								var oCustomField = new sap.ui.core.CustomData({
									key: "FieldName",
									value: seldata1.SelField2Name
								});
								var oCustomassign = new sap.ui.core.CustomData({
									key: "AssignmentId",
									value: ""
								});
								var oCustomLabel = new sap.ui.core.CustomData({
									key: "FieldLabel",
									value: seldata1.SelField2Text
								});
								filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
									groupTitle: "searchFields",
									groupName: "Assignment",
									name: seldata1.SelField2Name,
									label: seldata1.SelField2Text,
									control: new sap.m.Input({
										customData: [oCustomField, oCustomassign, oCustomLabel],
										valueHelpRequest: that.onValueHelp.bind(that)
									})
								}));
								that.selectionField2 = seldata1.SelField2Name;
							}
						}
						if (seldata1.SelField3Text && seldata1.SelField3Text !== "") {
							if ((seldata1.SelField3Text !== seldata1.SelField2Text) && (seldata1.SelField3Text !== seldata1.SelField1Text)) {
								var oCustomField = new sap.ui.core.CustomData({
									key: "FieldName",
									value: seldata1.SelField3Name
								});
								var oCustomassign = new sap.ui.core.CustomData({
									key: "AssignmentId",
									value: ""
								});
								var oCustomLabel = new sap.ui.core.CustomData({
									key: "FieldLabel",
									value: seldata1.SelField3Text
								});
								filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
									groupTitle: "searchFields",
									groupName: "Assignment",
									name: seldata1.SelField3Name,
									label: seldata1.SelField3Text,
									control: new sap.m.Input({
										customData: [oCustomField, oCustomassign, oCustomLabel],
										valueHelpRequest: that.onValueHelp.bind(that)
									})
								}));
								that.selectionField3 = seldata1.SelField3Name;
							}
						}
						if (seldata1.SelField4Text && seldata1.SelField4Text !== "") {
							if ((seldata1.SelField4Text !== seldata1.SelField3Text) && (seldata1.SelField4Text !== seldata1.SelField2Text) && (seldata1.SelField4Text !==
									seldata1.SelField1Text)) {
								var oCustomField = new sap.ui.core.CustomData({
									key: "FieldName",
									value: seldata1.SelField4Name
								});
								var oCustomassign = new sap.ui.core.CustomData({
									key: "AssignmentId",
									value: ""
								});
								var oCustomLabel = new sap.ui.core.CustomData({
									key: "FieldLabel",
									value: seldata1.SelField4Text
								});
								filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
									groupTitle: "searchFields",
									groupName: "Assignment",
									name: seldata1.SelField4Name,
									label: seldata1.SelField4Text,
									control: new sap.m.Input({
										customData: [oCustomField, oCustomassign, oCustomLabel],
										valueHelpRequest: that.onValueHelp.bind(that)
									})
								}));
								that.selectionField4 = seldata1.SelField4Name;
							}
						}

						if (seldata1.SelField5Text && seldata1.SelField5Text !== "") {
							if ((seldata1.SelField5Text !== seldata1.SelField4Text) && (seldata1.SelField5Text !== seldata1.SelField3Text) && (seldata1.SelField5Text !==
									seldata1.SelField2Text) && (seldata1.SelField5Text !== seldata1.SelField1Text)) {
								var oCustomField = new sap.ui.core.CustomData({
									key: "FieldName",
									value: seldata1.SelField5Name
								});
								var oCustomassign = new sap.ui.core.CustomData({
									key: "AssignmentId",
									value: ""
								});
								var oCustomLabel = new sap.ui.core.CustomData({
									key: "FieldLabel",
									value: seldata1.SelField5Text
								});
								filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
									groupTitle: "searchFields",
									groupName: "Assignment",
									name: seldata1.SelField5Name,
									label: seldata1.SelField5Text,
									control: new sap.m.Input({
										customData: [oCustomField, oCustomassign, oCustomLabel],
										valueHelpRequest: that.onValueHelp.bind(that)
									})
								}));
								that.selectionField5 = seldata1.SelField5Name;
							}
						}
						if (seldata1.SelField6Text && seldata1.SelField6Text !== "") {
							if ((seldata1.SelField6Text !== seldata1.SelField5Text) && (seldata1.SelField6Text !== seldata1.SelField4Text) && (seldata1.SelField6Text !==
									seldata1.SelField3Text) && (seldata1.SelField6Text !== seldata1.SelField2Text) && (seldata1.SelField6Text !== seldata1.SelField1Text)) {
								var oCustomField = new sap.ui.core.CustomData({
									key: "FieldName",
									value: seldata1.SelField6Name
								});
								var oCustomassign = new sap.ui.core.CustomData({
									key: "AssignmentId",
									value: ""
								});
								var oCustomLabel = new sap.ui.core.CustomData({
									key: "FieldLabel",
									value: seldata1.SelField6Text
								});
								filter.push(new sap.ui.comp.filterbar.FilterGroupItem({
									groupTitle: "searchFields",
									groupName: "Assignment",
									name: seldata1.SelField6Name,
									label: seldata1.SelField6Text,
									control: new sap.m.Input({
										customData: [oCustomField, oCustomassign, oCustomLabel],
										valueHelpRequest: that.onValueHelp.bind(that)
									})
								}));
								that.selectionField6 = seldata1.SelField6Name;
							}
						}

						var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
							advancedMode: true,
							filterBarExpanded: false,
							showGoOnFB: !sap.ui.Device.system.phone,
							filterGroupItems: filter,
							search: function (event) {
								if (that.oFilterBar._oBasicSearchField === null || that.oFilterBar._oBasicSearchField === undefined) {
									var basicSearchString = "";
								} else {
									var basicSearchString = that.oFilterBar._oBasicSearchField.getProperty("value");
									if (basicSearchString) {
										basicSearchString = "*" + basicSearchString + "*";
									}
								}
								if (event.getParameters().selectionSet[0]) {
									that.MaxHits = event.getParameters().selectionSet[0].getValue();
								}
								if (event.getParameters().selectionSet[1]) {
									that.selectionField1Val = event.getParameters().selectionSet[1].getValue();
									that.selectionField1Val = "*" + that.selectionField1Val + "*";
								}
								if (event.getParameters().selectionSet[2]) {
									that.selectionField2Val = event.getParameters().selectionSet[2].getValue();
									that.selectionField2Val = "*" + that.selectionField2Val + "*";
								}
								if (event.getParameters().selectionSet[3]) {
									that.selectionField3Val = event.getParameters().selectionSet[3].getValue();
									that.selectionField3Val = "*" + that.selectionField3Val + "*";
								}
								if (event.getParameters().selectionSet[4]) {
									that.selectionField4Val = event.getParameters().selectionSet[4].getValue();
									that.selectionField4Val = "*" + that.selectionField4Val + "*";
								}
								if (event.getParameters().selectionSet[5]) {
									that.selectionField5Val = event.getParameters().selectionSet[5].getValue();
									that.selectionField5Val = "*" + that.selectionField5Val + "*";
								}
								if (event.getParameters().selectionSet[6]) {
									that.selectionField6Val = event.getParameters().selectionSet[6].getValue();
									that.selectionField6Val = "*" + that.selectionField6Val + "*";
								}
								/*	if (that.RelatedFieldName) {
										that.FieldName = that.RelatedFieldName;
									}*/
								that.getValueHelpCollection(that.FieldName, that.SourceField, {
									fieldName: "FieldValue",
									operation: sap.ui.model.FilterOperator.EQ,
									value: basicSearchString
								});
							}
						});
						if (oFilterBar.setBasicSearch) {
							if (that.DispField1Header && that.DispField1Header !== "") {
								oFilterBar.setBasicSearch(new sap.m.SearchField({
									showSearchButton: sap.ui.Device.system.phone,
									placeholder: that.oBundle.getText('searchWithField', [data1[0].DispField1Header]),
									search: function (event) {
										var oFilter = [];
										var selectedKey = event.getParameter('query');
										if (selectedKey) {
											selectedKey = "*" + selectedKey + "*";
										}
										var FilterOperator = sap.ui.model.FilterOperator.Contains;
										oFilter.push(new sap.ui.model.Filter("DispField1Val", FilterOperator, selectedKey));
										if (that.FieldName === 'APPROVER') {
											that.getValueHelpCollection(that.FieldName, that.SourceField, {
												fieldName: "FieldValue",
												operation: sap.ui.model.FilterOperator.EQ,
												value: selectedKey
											});
										} else {
											// invoking search to get valid results from backend
											that.getValueHelpCollection(that.FieldName, that.SourceField, {
												fieldName: "FieldValue",
												operation: sap.ui.model.FilterOperator.EQ,
												value: selectedKey
											});
										}
									}
								}));
							} else {
								oFilterBar.setBasicSearch(new sap.m.SearchField({
									showSearchButton: sap.ui.Device.system.phone,
									placeholder: that.oBundle.getText('searchWithKey'),
									search: function (event) {
										var oFilter = [];
										var selectedKey = event.getParameter('query');
										var FilterOperator = sap.ui.model.FilterOperator.Contains;
										oFilter.push(new sap.ui.model.Filter("DispField1Id", FilterOperator, selectedKey));
										that.oValueTable.getBinding('rows').filter(oFilter);
									}
								}));
							}

						}
						that.oFilterBar = oFilterBar;
						oEvent.getSource().setFilterBar(oFilterBar);
						oEvent.getSource().update();
					},
					handleAfterClose1: function (oEvent) {
						that.oValueHelpSource = that.RelatedValueSource;
						that.oDialog1.destroy();
						that.oValueTable1 = null;
						that.selectionField1 = that.retField1;
						that.selectionField2 = that.retField2;
						that.selectionField3 = that.retField3;
						that.selectionField4 = that.retField4;
						that.selectionField5 = that.retField5;
						that.selectionField6 = that.retField6;

					},
					//					handleClickValueHelp1: that.handleClick.bind(that)
					handleClickValueHelp1: function (oEvent) {
						var value = oEvent.getParameter('tokens');
						this.oValueHelpSource.setValue(value[0].getKey());
						oEvent.getSource().close();
					}
				};

				that.oDialog1 = sap.ui.xmlfragment(oView.getId(), "hcm.fab.mytimesheet.view.fragments.ValueHelpDialog1", that.oDialogController1);
				oView.addDependent(that.oDialog1);
				that.oDialog1.open();
			}
		},

		getValueHelpCollection: function (FieldName, oSource, search) {
			var that = this;
			this.SourceField = oSource;
			this.showBusy();
			var oModel = new JSONModel();
			var orgModel = new JSONModel();
			var f = [];
			var oContainer = this.getModel("EditedTask1").getData().fields;
			//var oFormContainers = this.getModel("EditedTask").getData().containers;
			var oFormContainers = [];
			var oEditedTask = this.getModel("EditedTask1").getData();
			//Sending all the data except the dummy data
			for (var index = 0; index < oContainer.length; index++) {
				for (var index1 = 0; index1 < oContainer[index].containers.length; index1++) {
					for (var index2 = 0; index2 < oContainer[index].containers[index1].form.length; index2++) {

						if (oContainer[index].containers[index1].form[index2].dummy === "true") {

						} else {
							oFormContainers.push({
								form: [oContainer[index].containers[index1].form[index2]]
							});
						}
					}

				}
			}
			var selectedFieldName = FieldName;
			var lc_separator = ";;";
			var lv_search_str = "";
			for (var j = 0; j < oFormContainers.length; j++) {
				for (var i = 0; i < oFormContainers[j].form.length; i++) {
					var fieldValue = oFormContainers[j].form[i].FieldValue;
					var fieldName = oFormContainers[j].form[i].FieldName;
					if (oFormContainers[j].form[i].FieldName ==
						"AssignmentName") {
						continue;
					} else if (oFormContainers[j].form[i].FieldName ==
						"APPROVER") {
						continue;
					} else if (oFormContainers[j].form[i].FieldName ==
						"AssignmentStatus") {
						continue;
					} else {
						if (fieldValue) {
							if (fieldValue.length !== 0 && fieldName !== selectedFieldName) {
								var lv_search_str_temp = fieldName + "=" + fieldValue;
								if (lv_search_str) {
									lv_search_str += lc_separator + lv_search_str_temp;
								} else {
									lv_search_str += lv_search_str_temp;
								}
							}
						}
					}
				}
			}
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
			var r = new sap.ui.model.Filter({
				path: "FieldRelated",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: lv_search_str
			});
			if (search) {
				if (FieldName !== "APPROVER") {
					var e = new sap.ui.model.Filter({
						path: search.fieldName,
						operator: search.operation,
						value1: search.value
					});
					f.push(e);
				}
			} else {
				if (FieldName === "APPROVER") {
					var e = new sap.ui.model.Filter({
						path: "FieldValue",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: "A"
					});
					f.push(e);
				}
			}
			f.push(c);
			f.push(d);
			f.push(r);
			if (oEditedTask.validFrom && !isNaN(oEditedTask.validFrom)) {
				var begindate = new sap.ui.model.Filter({
					path: "Startdate",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: this.formatter.formatToBackendString(oEditedTask.validFrom)
				});
				f.push(begindate);
			}
			if (oEditedTask.validTo && !isNaN(oEditedTask.validTo)) {
				var enddate = new sap.ui.model.Filter({
					path: "Enddate",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: this.formatter.formatToBackendString(oEditedTask.validTo)
				});
				f.push(enddate);
			}
			if (that.MaxHits) {
				if (that.handleMaxHits === "X") {
					if (/^\d+$/.test(that.MaxHits) !== true) {
						that.MaxHits = 150;
					}
					var maxHitsFilter = new sap.ui.model.Filter({
						path: "MaximumHits",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: that.MaxHits
					});
					f.push(maxHitsFilter);
				}
			}
			if (that.selectionField1Val && that.selectionField1Val != "*") {
				var sName1 = new sap.ui.model.Filter({
					path: "SelField1Name",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField1
				});
				var sValue1 = new sap.ui.model.Filter({
					path: "SelField1Val",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField1Val
				});
				f.push(sName1);
				f.push(sValue1);
			}
			if (that.selectionField2Val && that.selectionField2Val != "*") {
				var sName2 = new sap.ui.model.Filter({
					path: "SelField2Name",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField2
				});
				var sValue2 = new sap.ui.model.Filter({
					path: "SelField2Val",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField2Val
				});
				f.push(sName2);
				f.push(sValue2);
			}
			if (that.selectionField3Val && that.selectionField3Val != "*") {
				var sName3 = new sap.ui.model.Filter({
					path: "SelField3Name",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField3
				});
				var sValue3 = new sap.ui.model.Filter({
					path: "SelField3Val",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField3Val
				});
				f.push(sName3);
				f.push(sValue3);
			}
			if (that.selectionField4Val && that.selectionField4Val != "*") {
				var sName4 = new sap.ui.model.Filter({
					path: "SelField4Name",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField4
				});
				var sValue4 = new sap.ui.model.Filter({
					path: "SelField4Val",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField4Val
				});
				f.push(sName4);
				f.push(sValue4);
			}

			if (that.selectionField5Val && that.selectionField5Val != "*") {
				var sName5 = new sap.ui.model.Filter({
					path: "SelField5Name",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField5
				});
				var sValue5 = new sap.ui.model.Filter({
					path: "SelField5Val",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField5Val
				});
				f.push(sName5);
				f.push(sValue5);
			}
			if (that.selectionField6Val && that.selectionField6Val != "*") {
				var sName6 = new sap.ui.model.Filter({
					path: "SelField6Name",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField6
				});
				var sValue6 = new sap.ui.model.Filter({
					path: "SelField6Val",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.selectionField6Val
				});
				f.push(sName6);
				f.push(sValue6);
			}
			var mParameters = {
				urlParameters: '$expand=ValueHelpHits',
				filters: f,
				success: function (oData, oResponse) {
					if (oData.results.length >= 1) {
						that.results = oData.results[0].ValueHelpHits.results;
						oModel.setData(that.results);
						that.MaxHits = null;
						if (oData.results[0].MaximumHits !== undefined) {
							that.handleMaxHits = "X";
						} else {
							that.handleMaxHits = "";
						}
						if (search) {
							oModel.getData().splice(0, 1);
							that.setModel(oModel, FieldName);
							if (that.oValueTable1 === null || that.oValueTable1 === undefined) {
								that.oValueTable.setModel(oModel);
								if (!sap.ui.Device.system.phone) {
									that.oValueTable.getTitle().setText(that.oBundle.getText("items", [oModel.getData().length]));
								}
							} else {
								that.oValueTable1.setModel(oModel);
								if (!sap.ui.Device.system.phone) {
									that.oValueTable1.getTitle().setText(that.oBundle.getText("items", [oModel.getData().length]));
								}
							}
						} else {
							if (that.oValueTable) {
								//								that.oValueTable.setModel(oModel);
							}
							that.setModel(oModel, FieldName); //For dependent field like VORNR
							that.setModel(oModel, "ValueHelpHits").updateBindings();
							orgModel.setData(oData.results[0]);
							that.setModel(orgModel, "ValueHelp").updateBindings();
						}
					}
					if (search) {
						// that.oValueTable.updateAggregation();
					} else {
						that.valueHelpFragment(oSource);
					}
					that.hideBusy(true);
				},
				error: function (oError) {
					that.hideBusy(true);
				}
			};
			this.oDataModel.read('/ValueHelpCollection', mParameters);
		},
		handleClick: function (oEvent) {
			var value = oEvent.getParameter('tokens');
			// this.oValueHelpSource.setTokens(value);
			this.oValueHelpSource.setValue(value[0].getKey());
			if (this.FieldName === "APPROVER") {
				this.getModel("EditedTask").getData().ApproverName = value[0].getText();
			}
			oEvent.getSource().close();
		},

		onAddToGroup: function (oEvent) {
			var that = this;
			// create popover
			var that = this;
			var oDialogController = {
				handleClose: function (event) {
					// that._oPopover.close();
					// that._oPopover.destroy();
				},

				handleSearch: function (event) {
					// build filter array
					var aFilter = [];
					//getting value from search box
					var searchText = event.getParameter("value");
					//if searchText is not empty
					if (searchText) {
						aFilter.push(new sap.ui.model.Filter({
							path: "AssignmentName",
							operator: sap.ui.model.FilterOperator.Contains,
							value1: searchText
						}));
					}
					// filter binding
					var oBinding = event.getSource().getBinding("items");
					oBinding.filter(aFilter);
				},

				handleOk: function (event) {

					// var index = oEvent.getSource().getBindingContext('Assignments').getPath().split('/')[1];
					var oCreateGroup = that.getModel("createGroup").getData();
					var oAssignments = that.getModel("Assignments").getData();
					var addData = that.getModel("AddAssignments").getData();
					var addAssignments = {
						"groupId": oCreateGroup.groupId === null ? "" : oCreateGroup.groupId,
						"groupName": oCreateGroup.groupName,
						"Assignments": []
					};
					for (var i = 0; i < event.getParameter("selectedContexts").length; i++) {
						var index = event.getParameter("selectedContexts")[i].getPath().split('/')[1];

						if (oCreateGroup.Assignments.length === 0) {
							oCreateGroup.Assignments.push({
								"AssignmentId": oAssignments[index].AssignmentId,
								"AssignmentName": oAssignments[index].AssignmentName,
								"Status": oAssignments[index].AssignmentStatus,
								"ValidityStartDate": oAssignments[index].ValidityStartDate,
								"ValidityEndDate": oAssignments[index].ValidityEndDate,
								"Rank": 1000 + i
							});
							addAssignments.Assignments.push({
								"AssignmentId": oAssignments[index].AssignmentId,
								"AssignmentName": oAssignments[index].AssignmentName,
								"Status": oAssignments[index].AssignmentStatus,
								"ValidityStartDate": oAssignments[index].ValidityStartDate,
								"ValidityEndDate": oAssignments[index].ValidityEndDate,
								"Rank": 1000 + i
							});
						} else {
							var oAssignmentFound = $.grep(oCreateGroup.Assignments, function (element, ind) {
								if (element) {
									return element.AssignmentId === oAssignments[index].AssignmentId;
								}

							});
							if (oAssignmentFound.length === 0) {
								oCreateGroup.Assignments.push({
									"AssignmentId": oAssignments[index].AssignmentId,
									"AssignmentName": oAssignments[index].AssignmentName,
									"Status": oAssignments[index].AssignmentStatus,
									"ValidityStartDate": oAssignments[index].ValidityStartDate,
									"ValidityEndDate": oAssignments[index].ValidityEndDate,
									"Rank": 1000 + i
								});
								addAssignments.Assignments.push({
									"AssignmentId": oAssignments[index].AssignmentId,
									"AssignmentName": oAssignments[index].AssignmentName,
									"Status": oAssignments[index].AssignmentStatus,
									"ValidityStartDate": oAssignments[index].ValidityStartDate,
									"ValidityEndDate": oAssignments[index].ValidityEndDate,
									"Rank": 1000 + i
								});
							}

						}

					}
					// that.setModel(new JSONModel(oCreateGroup), "createGroup");

					that.getModel("createGroup").setData(oCreateGroup);
					var seqNumber = 1;
					var sortedData =
						that.getModel("createGroup").getData().Assignments.sort(function (element1, element2) {

							if (element1.Rank <= element2.Rank) {
								return -1;
							}
							return 1;

						});

					sortedData.forEach(function (element1) {
						element1.Rank = seqNumber;
						seqNumber = seqNumber + 1;
					});
					var oControls = that.getModel("controls");
					if (oCreateGroup.Assignments.length > 0) {
						oControls.setProperty('/createGroupSave', true);
					} else {
						oControls.setProperty('/createGroupSave', false);
					}
					that.setGlobalModel(oControls, "controls");
					if (addAssignments.Assignments.length > 0) {
						addAssignments.Assignments = sortedData;
						that.getModel("AddAssignments").setData(addAssignments);

					} else {
						// addData.Assignments.push(addAssignments.Assignments[0]);
						that.getModel("AddAssignments").setData(addData);
					}

					// that._oPopover.close();
					// that._oPopover.destroy();
				},
				handleChange: function (oEvent) {},
			};
			var data = $.extend(true, [], this.getModel('Assignments').getData());
			// var oModel = new JSONModel(data);
			// this.setModel(oModel, "oldModel");
			if (!this._oPopover) {
				this._oPopover = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.AddAssignmentsInGroup",
					oDialogController);
				// this._oPopover.bindElement('TimeData>' + oEvent.getSource().getBindingContext('TimeData').getPath());
				this.getView().addDependent(this._oPopover);

			}

			// delay because addDependent will do a async rerendering and the popover will immediately close without it
			jQuery.sap.delayedCall(0, this, function () {
				this._oPopover.open(oEvent.getSource());
			});
		},
		processMove: function (sDirection, oEvent) {
			//Moving the item in the specified direction
			//Retrieving the selected item

			var oTable = this.getView().byId("idCreateGroup");
			if (!oTable.getSelectedItem()) {
				return;
			}
			//Getting Selected Item
			var getBindingContext = oTable.indexOfItem(oTable.getSelectedItem());

			//undefined
			//for(var i = 0 ; i < oTable.getItems().length ; i++){if(oTable.getItems()[i] === oTable.getSelectedItem()){getBindingContext = i; break;} }
			//Swapping the items based on the event
			//Getting the directed neighbour
			var directedNeighbourIndex = null;
			if (sDirection === "Up") {

				if (getBindingContext !== 0)
					directedNeighbourIndex = getBindingContext - 1;
			}

			if (sDirection === "Down") {
				if (getBindingContext !== oTable.getItems().length - 1) {
					directedNeighbourIndex = getBindingContext + 1;
				}
			}

			if (directedNeighbourIndex !== null) {
				//////
				//Swapping the ranks
				var oAssignments = oTable.getModel("createGroup");
				var selectedRank = oTable.getItems()[getBindingContext].getBindingContext("createGroup").getProperty("Rank");

				var neighbourRank = oTable.getItems()[directedNeighbourIndex].getBindingContext("createGroup").getProperty("Rank");

				var selectedBindingContext = parseInt(oTable.getItems()[getBindingContext].getBindingContextPath("createGroup").split("/")[2]);

				var neighbourContext = parseInt(oTable.getItems()[directedNeighbourIndex].getBindingContextPath("createGroup").split("/")[2]);

				this.getModel("createGroup").setProperty("/Assignments/" + neighbourContext + "/Rank", selectedRank);

				this.getModel("createGroup").setProperty("/Assignments/" + selectedBindingContext + "/Rank", neighbourRank);

				//	this.getModel("createGroup").refresh();

				oTable.getItems()[directedNeighbourIndex].setSelected(true);
			}

		},
		moveUp: function (oEvent) {

			this.processMove("Up");
		},

		moveDown: function (oEvent) {

			this.processMove("Down");
		},
		onRemoveAssignment: function (oEvent) {
			var that = this;
			var oTable = this.byId('idCreateGroup');
			var oSelectedGroup = this.getModel("createGroup").getData();
			var deleteData = this.getModel("DeleteAssignments").getData();
			var deleteAssignments = {
				"groupId": oSelectedGroup.groupId,
				"groupName": oSelectedGroup.groupName,
				"Assignments": []
			};
			var index = oEvent.getSource().getParent().getBindingContext('createGroup').getPath().split('/')[2];

			deleteAssignments.Assignments.push($.extend(true, {}, oSelectedGroup.Assignments[index]));
			oSelectedGroup.Assignments.splice(index, 1);
			// this.setModel(new JSONModel(oSelectedGroup), "createGroup");
			this.getModel("createGroup").setData(oSelectedGroup);
			if (!deleteData.Assignments) {
				this.getModel("DeleteAssignments").setData(deleteAssignments);
			} else {
				deleteData.Assignments.push(deleteAssignments.Assignments[0]);
				this.getModel("DeleteAssignments").setData(deleteData);
			}

		},
		handleSubmitInput: function (oEvent) {
			// var that = this;
			// var oAssignment = this.getModel("createGroup").getData();
			// var addAssignments = {
			// 	"groupId": oAssignment.groupId,
			// 	"groupName": oAssignment.groupName,
			// 	"Assignments": oAssignment.Assignments
			// };
			// if (!oAssignment.Assignments) {
			// 	that.getModel("AddAssignments").setData(addAssignments);
			// } else {
			// 	oAssignment.Assignments.push(addAssignments.Assignments[0]);
			// 	that.getModel("AddAssignments").setData(oAssignment);
			// }
			// this.getModel("AddAssignments").setData(addAssignments);
		},
		changeFirstDayOfWeek: function (oEvent) {
			var oModel = this.getGlobalModel("firstDayOfWeek");
			if (oModel !== undefined) {
				oEvent.getSource()._oCalendar.setFirstDayOfWeek(oModel.getData().day);
			}

		},

		getCustomData: function (oEvent) {
			var that = this;
			var captureSource = oEvent.getSource();
			var index = oEvent.getSource().getCustomData()[0].getValue();
			var oData = this.getModel("AdditionalHelp").getData();
			var helpData = null;
			if (index === "") {

				this.getModel("AdditionHelp").setData(oData[oData.length - 1]);
				if (this.getModel("AdditionHelp").getData().GroupName === "") {
					this.getModel("AdditionHelp").setProperty("/GroupName", "Field Collection");

				}

			} else {
				this.getModel("AdditionHelp").setData(oData[parseInt(index)]);
				if (this.getModel("AdditionHelp").getData().GroupName === "") {
					this.getModel("AdditionHelp").setProperty("/GroupName", "Field Collection");
				}

			}

			var noGroupElements = $.grep(this.getModel("AdditionHelp").getData().groupHelp, function (value) {

				if (value.AdditionHelp === "") {
					return false;
				}
				return true;

			});
			var noOfElements = noGroupElements.length === 0 ? true : false;

			if (noOfElements) //No help maintained for anyfield inside the field group
			{
				//Loading a different fragment to show no data found
				var oNoHelpDialog;
				//If Already exist
				if (oNoHelpDialog) {
					oNoHelpDialog.destroy();
				}

				var oNoHelpDialogController = {
					handleClose: function (event) {
						oNoHelpDialog.close();
					}
				};
				//If no dialog, adding the fragment to the view 
				if (!oNoHelpDialog) {
					oNoHelpDialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.NoAdditionalHelpFragment",
						oNoHelpDialogController);
					this.getView().addDependent(oNoHelpDialog);
					// oDialog.bindElement('TimeData>' + oEvent.getSource().getBindingContext('TimeData').getPath());
				}
				var oButton = oEvent.getSource();
				jQuery.sap.delayedCall(0, this, function () {
					oNoHelpDialog.open(oButton);
				});

			} else { //Atleast one field have a additional help inside the field collection group
				var oDialog;
				if (oDialog) {
					oDialog.destroy();
				}
				var oDialogController = {
					handleClose: function (event) {
						oDialog.close();
					},
					controller: that,

					dialogSource: captureSource,
					isVisible: function (visible) {
						return visible === true ? true : false;
					},
					focusElement: function (event) {
						var that = this;
						this.elementIndex = parseInt(event.getParameter("srcControl").getBindingContext("AdditionHelp").getPath().split("/groupHelp/")[
							1]);
						//Index position inside the block

						oDialog.attachAfterClose(function () {
							var element = that.dialogSource.getParent().getParent().getAggregation("content")[0].getAggregation("formContainers")[
								that.elementIndex].getAggregation('formElements')[0].getFields()[0];
							if (element.getItems()[0].getVisible() === true) //All input field case
							{
								// element.getItems()[0].setValueState(sap.ui.core.ValueState.Success);
								// element.getItems()[0].setValueStateText("Item Selected from additional help");
								jQuery.sap.delayedCall(200, this, function () {

									element.getItems()[0].focus();
								});
							} else if (element.getItems()[2].getVisible() === true) //Additional handling in case of date picker Finish forecast date
							{
								// element.getItems()[2].setValueState(sap.ui.core.ValueState.Success);
								// element.getItems()[2].setValueStateText("Item Selected from additional help");

								jQuery.sap.delayedCall(200, this, function () {

									element.getItems()[2].focus();
								});

							} else {
								jQuery.sap.delayedCall(200, this, function () {

									element.getItems()[3].focus();
								});
							}
						});
						oDialog.close();

					}
				};
				if (!oDialog) {
					oDialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.AdditionalHelpFragment",
						oDialogController);
					this.getView().addDependent(oDialog);
					// oDialog.bindElement('TimeData>' + oEvent.getSource().getBindingContext('TimeData').getPath());
				}

				// delay because addDependent will do a async rerendering and the popover will immediately close without it
				var oButton = oEvent.getSource();
				jQuery.sap.delayedCall(0, this, function () {
					oDialog.open(oButton);
				});

			}
		}

	});
});