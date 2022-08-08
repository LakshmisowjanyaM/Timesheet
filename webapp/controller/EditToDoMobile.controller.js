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

	return BaseController.extend("hcm.fab.mytimesheet.controller.EditToDoMobile", {

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
			this.oDataModel = this.getOwnerComponent().getModel();
			this.oBundle = this.getResourceBundle();
			var oModel = this.getGlobalModel("EditTodo");
			var oTask = this.getGlobalModel("Tasks");
			var oUnit = this.getGlobalModel("UNIT");
			this.setModel(oTask, "Tasks");
			var oTextModel = this.getGlobalModel("i18n");
			this.setModel(oUnit, "UNIT");
			this.setModel(oTextModel, "i18n");
			this.setModel(oModel, "EditTodo");
			this.oRouter = this.getRouter();
			this.oRouter.getRoute("editToDo").attachMatched(this._onObjectMatched.bind(this), this);
		},
		_onObjectMatched: function() {
			var oUnit = this.getGlobalModel("UNIT");
			this.setModel(oUnit, "UNIT");
			var oModel = this.getGlobalModel("EditTodo");
			this.setModel(oModel, "EditTodo");
			var oTask = this.getGlobalModel("Tasks");
			// var oModel = new JSONModel(oTask);
			this.setModel(oTask, "Tasks");
		},
		onSelectionChange: function(oEvent) {
			var selectedKey = oEvent.getParameter('selectedItem').getKey();
			var selectedText = oEvent.getParameter('selectedItem').getText();
			var oModel = this.getModel('EditTodo');
			var data = oModel.getData();
			var workdate = data.TimeEntryDataFields.WORKDATE;
			var hours = data.TimeEntryDataFields.CATSHOURS;
			var status = data.TimeEntryDataFields.STATUS;
			delete data.TimeEntryDataFields;
			var taskdata = this.getModel('Tasks').getData();
			var task = $.grep(taskdata, function(element, index) {
				return element.AssignmentId === selectedKey;
			});
			data.TimeEntryDataFields = $.extend(true, {}, task[0].AssignmentFields);
			data.TimeEntryDataFields.WORKDATE = workdate;
			data.TimeEntryDataFields.CATSHOURS = hours;
			data.TimeEntryDataFields.STATUS = status;
			data.AssignmentName = selectedText;
			data.AssignmentId = selectedKey;
			if (data.Counter && data.Counter !== null && data.Counter !== "") {
				data.TimeEntryOperation = 'U';
				data.deleteButtonEnable = true;
				data.addButtonEnable = true;
			} else {
				data.TimeEntryOperation = 'C';
				data.deleteButtonEnable = true;
				data.addButtonEnable = true;
			}
			oModel.setData(data);
			this.setModel(oModel, 'EditTodo');
		},
		handleLongText: function(oEvent) {
			if (oEvent.getSource().getValue().length > 0) {
				var oModel = this.getModel('EditTodo');
				var data = oModel.getData();
				data.TimeEntryDataFields.LONGTEXT = 'X';
			}

		},
		onToDoSubmit: function(oEvent) {
			var that = this;
			var submitEntries = this.fetchToDoRecords();
			var selectedItems;
			var oModel = $.extend(true, {}, this.oDataModel);
			var oControl = this.getModel("controls");
			oModel.setChangeBatchGroups({
				"*": {
					groupId: "TimeEntry",
					changeSetId: "TimeEntry",
					single: false
				}
			});
			oModel.setDeferredGroups(["TimeEntry"]);
			oModel
				.refreshSecurityToken(
					function(oData) {
						// for (var i = 0; i < submitEntries.length; i++) {
						var obj = {
							properties: submitEntries,
							changeSetId: "TimeEntry",
							groupId: "TimeEntry"
						};
						oModel
							.createEntry(
								"/TimeEntryCollection",
								obj);
						// }
						oModel.submitChanges({
							groupId: "TimeEntry",
							changeSetId: "TimeEntry",
							success: function(oData, res) {
								if (!oData.__batchResponses[0].__changeResponses) {
									// for (var i=0; i<that.batches.length;i++){
									// 	that.batches[i].TimeEntryDataFields.WORKDATE = new Date(that.batches[i].TimeEntryDataFields.WORKDATE);
									// }
									return;
								    that.getRouter().navTo("worklist", {}, true);
								}
								var toastMsg = that.oBundle.getText("timeEntriesSaved");
								sap.m.MessageToast.show(toastMsg, {
									duration: 1000
								});
								that.getRouter().navTo("worklist", {}, true);
								// that.getToDoList();
								// if (that.oReadOnlyToDoTemplate) {
								// 	that.rebindTableWithTemplate(that.oToDoTable, "TodoList>/", that.oReadOnlyToDoTemplate, "Navigation");
								// }
								// oControl.setProperty("/editTodoVisibility", true);
								// oControl.setProperty("/todoDone", false);
								// oControl.setProperty("/todoCancel", false);
								// oControl.setProperty("/showFooter", false);

							},
							error: function(oError) {
								var toastMsg = that.oBundle.getText("error");
								sap.m.MessageToast.show(toastMsg, {
									duration: 1000
								});
							}
						});

					}, true);
			// oModel.attachBatchRequestCompleted(this.onSubmissionSuccess.bind(this));
		},
		fetchToDoRecords: function() {
			// var timeEntries = [];
			// var deleteRecords = this.getModel('deleteRecords').getData();
			var entries = $.extend(true, {}, this.getModel('EditTodo').getData());
			// var newRecords = $.grep(entries, function(element, index) {
			// 	return element.TimeEntryOperation == 'C';
			// });
			// var changedRecords = $.grep(entries, function(element, index) {
			// 	return element.TimeEntryOperation == 'U';
			// });
			// for (var i = 0; i < changedRecords.length; i++) {
			delete entries.target;
			delete entries.missing;
			delete entries.sendButton;
			delete entries.total;
			delete entries.addButton;
			delete entries.addButtonEnable;
			delete entries.deleteButtonEnable;
			// entries.TimeEntryOperation = 'C';
			entries.AllowRelease = 'X';
			entries.TimeEntryDataFields.WORKDATE = this.formatter.formatToBackendString(entries.TimeEntryDataFields.WORKDATE) +
				"T00:00:00";
			delete entries.TimeEntryDataFields.ERSDA;
			delete entries.TimeEntryDataFields.LAEDA;
			delete entries.TimeEntryDataFields.LAETM;
			delete entries.TimeEntryDataFields.ERSTM;
			delete entries.TimeEntryDataFields.APDAT;
			// }
			// for (var i = 0; i < newRecords.length; i++) {
			// delete newRecords[i].target;
			// delete newRecords[i].missing;
			// delete newRecords[i].sendButton;
			// delete newRecords[i].total;
			// delete newRecords[i].addButton;
			// delete newRecords[i].addButtonEnable;
			// delete newRecords[i].deleteButtonEnable;
			// newRecords[i].TimeEntryOperation = 'C';
			// newRecords[i].AllowRelease = 'X';
			// }
			// if (changedRecords.length > 0) {
			// 	for (var i = 0; i < changedRecords.length; i++) {
			// 		timeEntries.push(changedRecords[i]);
			// 	}
			// }
			// if (newRecords.length > 0) {
			// 	for (var i = 0; i < newRecords.length; i++) {
			// 		timeEntries.push(newRecords[i]);
			// 	}
			// }
			for (var i = 0; i < entries.length; i++) {
				entries[i].RecRowNo = (i + 1).toString();
			}			
			return entries;
		},
		onNavButton: function() {
			this.getRouter().navTo("worklist", {}, true);
		},
		/**
		 * Handled when user clicks on back button to navigate to previous screen
		 */
		onNavBack: function() {
			// var sPreviousHash = History.getInstance().getPreviousHash(),
				// oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
			this.getRouter().navTo("worklist", {}, true);
			// this._deleteUnsavedRecord();

			// if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
			// 	history.go(-1);
			// } else {
			// 	oCrossAppNavigator.toExternal({
			// 		target: {
			// 			shellHash: "#Shell-home"
			// 		}
			// 	});
			// }
		},
		onCancel: function() {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			// var oModel = new JSONModel();
			// var data = [];
			// oModel.setData(data);
			// this.setModel(oModel, "EditTodo");
			// this.setModel(oModel, "Tasks");
			// this.setGlobalModel(oModel, "EditTodo");
			// this.setGlobalModel(oModel, "Tasks");
			this.getRouter().navTo("worklist", {}, true);
		}

	});

});