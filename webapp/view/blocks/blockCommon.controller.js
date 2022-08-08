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

], function (BaseController, JSONModel, formatter, MessagePopover, History, Dialog, Text) {
	"use strict";

	return BaseController.extend("hcm.fab.mytimesheet.view.blocks.blockCommon", {
		formatter: formatter,
		onInit: function () {
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0
				});
			this._nCounter = 0;
			this.oBundle = this.getResourceBundle();
			var oModel = this.getGlobalModel("ProfileFields");
			var oControl = this.getGlobalModel("controls");
			this.oControl = oControl;
			this.busyDialog = new sap.m.BusyDialog();
			// var oEditModel = this.getGlobalModel("EditedTask");
			// this.setModel(oControl, "controls");
			// this.setModel(oEditModel, "EditedTask");
			this.oRouter = this.getRouter();
			var oPernr = this.getPernr();
			if (!oPernr) {
				this.oRouter.navTo("worklist", {}, true);
			} else {
				this.empID = oPernr.getData();
			}
			this.oDataModel = this.getOwnerComponent().getModel();
			this.oBundle = this.getResourceBundle();
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
				}
			};
			this.oDataModel.read('/ValueHelpCollection', mParameters);
		},
		handleClick: function (oEvent) {
			var value = oEvent.getParameter('tokens');
			// this.oValueHelpSource.setTokens(value);
			this.oValueHelpSource.setValue(value[0].getKey());
			oEvent.getSource().close();
		},

	});
});