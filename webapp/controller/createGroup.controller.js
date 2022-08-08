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
	return BaseController.extend("hcm.fab.mytimesheet.controller.createGroup", {
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
			this.oBundle = this.getResourceBundle();
			this.oDataModel = this.getOwnerComponent().getModel();
			var oModel = this.getGlobalModel("ProfileFields");
			var oControl = this.getGlobalModel("controls");
			this.setModel(new JSONModel({}), "AddAssignments");
			this.setModel(new JSONModel({}), "DeleteAssignments");
			// this.setModel(new JSONModel([]), "UpdateAssignments");
			var oAssignments = this.getGlobalModel("Tasks");
			this.setModel(oAssignments, "Assignments");
			this.oControl = oControl;
			this.setModel(this.oControl, "controls");
			this.busyDialog = new sap.m.BusyDialog();
			var oGroupModel = $.extend(true, new JSONModel(), this.getGlobalModel("createGroup"));
			this.setModel(oGroupModel, "createGroup");

			this.oRouter = this.getRouter();
			var oPernr = this.getPernr();
			if (!oPernr) {
				this.oRouter.navTo("worklist", {}, true);
			} else {
				this.empID = oPernr.getData();
			}
			// if (this.oControl.getProperty('/createGroup') === true) {
			// 	this.setModel(new JSONModel({
			// 		"groupId": "",
			// 		"groupName": "",
			// 		"Assignments": oGroupModel.getData().Assignments
			// 	}), "AddAssignments");
			// } else {
			// 	this.setModel(new JSONModel({}), "AddAssignments");
			// }
			if (oControl) {
				if (oControl.getProperty("/createGroup") === true) {
					this.setModel(new JSONModel({
						"Name": this.oBundle.getText("createGroup")
					}), "Title");
				} else if (oControl.getProperty("/editGroup") === true) {
					this.setModel(new JSONModel({
						"Name": this.oBundle.getText("editGroup")
					}), "Title");
				} else {
					this.setModel(new JSONModel({
						"Name": this.oBundle.getText("displayGroup")
					}), "Title");
				}
			}

			this.oDataModel = this.getOwnerComponent().getModel();
			this.oErrorHandler = this.getOwnerComponent()._oErrorHandler;
			this.oRouter.getRoute("createGroup").attachMatched(this._onObjectMatched.bind(this), this);
			// Handle validation
			this.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
			sap.ui.getCore().attachParseError(controlErrorHandler);
			sap.ui.getCore().attachValidationSuccess(controlNoErrorHandler);
			sap.ui.getCore().getMessageManager().registerObject(this.getView(), true);

		},
		_onObjectMatched: function () {
			this.oDataModel = this.getOwnerComponent().getModel();
			this.oBundle = this.getResourceBundle();
			var oModel = this.getGlobalModel("ProfileFields");
			var oControl = this.getGlobalModel("controls");
			this.setModel(oControl, "controls");

			this.setModel(new JSONModel({}), "DeleteAssignments");
			var oGroupModel = $.extend(true, new JSONModel(), this.getGlobalModel("createGroup"));
			this.setModel(oGroupModel, "createGroup");
			if (oControl.getProperty('/createGroup') === true) {
				this.setModel(new JSONModel({
					"groupId": "",
					"groupName": "",
					"Assignments": oGroupModel.getData().Assignments
				}), "AddAssignments");
				// if (oControl) {
				// if (oControl.getProperty("/createGroup") === true) {
				this.setModel(new JSONModel({
					"Name": this.oBundle.getText("createGroup")
				}), "Title");
				// }
				// }
			} else if (oControl.getProperty('/editGroup') === true) {
				// this.setModel(new JSONModel({}), "AddAssignments");
				this.setModel(new JSONModel({
					"groupId": oGroupModel.getData().groupId,
					"groupName": oGroupModel.getData().groupName,
					"Assignments": oGroupModel.getData().Assignments
				}), "AddAssignments");
				this.setModel(new JSONModel({
					"Name": this.oBundle.getText("editGroup")
				}), "Title");
			} else {
				this.setModel(new JSONModel({
					"groupId": oGroupModel.getData().groupId,
					"groupName": oGroupModel.getData().groupName,
					"Assignments": oGroupModel.getData().Assignments
				}), "AddAssignments");
				this.setModel(new JSONModel({
					"Name": this.oBundle.getText("displayGroup")
				}), "Title");
			}
			var oAssignments = this.getGlobalModel("Tasks");
			this.setModel(oAssignments, "Assignments");
			// Handle validation
			this.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
			sap.ui.getCore().attachParseError(controlErrorHandler);
			sap.ui.getCore().attachValidationSuccess(controlNoErrorHandler);
			sap.ui.getCore().getMessageManager().registerObject(this.getView(), true);
		},
		onExit: function () {
			// this.byId("dynamicPageId").destroy();
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oModel = new JSONModel();
			var data = [];
			oModel.setData(data);
			this.setModel(oModel, "createGroup");
			// this.setModel(oModel, "DisplayTask");
			// this.setGlobalModel(oModel, "DisplayTask");
			// this.setGlobalModel(oModel, "EditedTask");
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
		/**
		 * Handled when user clicks on back button to navigate to previous screen
		 */
		onNavBack: function () {
			// sap.ui.getCore().getMessageManager().removeAllMessages();
			var oModel = new JSONModel();
			var data = [];
			oModel.setData(data);
			this.setModel(oModel, "createGroup");
			this.setModel(new JSONModel({}), "AddAssignments");
			this.setModel(new JSONModel({}), "DeleteAssignments");
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
			this.setModel(oModel, "createGroup");
			this.getRouter().navTo("worklist", {}, true);
			this.setModel(new JSONModel({}), "AddAssignments");
			this.setModel(new JSONModel({}), "DeleteAssignments");
		},
		onCancel: function () {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			// this.getRouter().navTo("worklist", {}, true);
			var that = this;
			var data = $.extend(true, new JSONModel(), this.getGlobalModel("createGroup"));
			this.setModel(data, "createGroup");
			// var data = $.extend(true, new JSONModel(), this.getGlobalModel("createGroup"));
			// this.setModel(data, "createGroup");
			var oControls = this.getModel("controls");
			this.setModel(new JSONModel({
				"Name": this.oBundle.getText("displayGroup")
			}), "Title");
			oControls.setProperty("/displayGroup", true);
			oControls.setProperty("/DeleteGroup", false);
			this.setModel(oControls, "controls");
			this.setGlobalModel(oControls, "controls");
			this.setModel(new JSONModel({}), "AddAssignments");
			this.setModel(new JSONModel({}), "DeleteAssignments");

		},
		onGroupEdit: function (oEvent) {
			var that = this;
			var data = $.extend(true, new JSONModel(), this.getGlobalModel("createGroup"));
			this.setModel(data, "createGroup");
			// var data = $.extend(true, new JSONModel(), this.getGlobalModel("createGroup"));
			// this.setModel(data, "createGroup");
			var oControls = this.getModel("controls");
			this.setModel(new JSONModel({
				"Name": this.oBundle.getText("editGroup")
			}), "Title");
			oControls.setProperty("/displayGroup", false);
			oControls.setProperty("/editGroup", true);
			oControls.setProperty("/DeleteGroup", false);
			oControls.setProperty("/GroupCancel", false);
			oControls.setProperty("/displayGroupCancel", true);
			this.setModel(oControls, "controls");
			this.setGlobalModel(oControls, "controls");

		},
		onGroupCancel: function (oEvent) {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oModel = new JSONModel();
			var data = [];
			oModel.setData(data);
			this.setModel(oModel, "createGroup");
			this.getRouter().navTo("worklist", {}, true);

		},
		onSave: function (oEvent) {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var that = this;
			var oGroup = this.getModel("createGroup").getData();
			var oMessages = [];
			if (oGroup.groupName == "") {
				this.getModel("createGroup").setProperty("/groupNameError", "Error");
				this.getModel("createGroup").setProperty("/groupNameErrorText", this.oBundle.getText("enterValidGroupName"));
				oMessages.push(new sap.ui.core.message.Message({
					message: this.oBundle.getText("enterValidGroupName"),
					type: sap.ui.core.MessageType.Error,
					processor: this.getOwnerComponent().oMessageProcessor
				}));
			} else {
				this.getModel("createGroup").setProperty("/groupNameError", "None");
				this.getModel("createGroup").setProperty("/groupNameErrorText", "");
			}
			if (oMessages.length > 0) {
				sap.ui.getCore().getMessageManager().addMessages(
					oMessages
				);
				return;
			}
			var oAddGroup = this.getModel("AddAssignments").getData();
			var oDeleteGroup = this.getModel("DeleteAssignments").getData();
			var oControl = this.getModel("controls");
			var oGroupData = [];
			if (oControl.getProperty('/editGroup') === true) {
				// for (var i = 0; i < oGroup.Assignments.length; i++) {
				// 	var data = {
				// 		GrpId: oGroup.groupId,
				// 		GrpName: oGroup.groupName,
				// 		AssignmentId: oGroup.Assignments[i].AssignmentId,
				// 		GrpOperation: 'U'
				// 	};
				// 	oGroupData.push(data);
				// }
				if (oAddGroup.Assignments) {
					for (var i = 0; i < oAddGroup.Assignments.length; i++) {
						var Rank = $.grep(oGroup.Assignments, function (element) {
							return oAddGroup.Assignments[i].AssignmentId === element.AssignmentId;
						});
						if (Rank.length > 0) {
							Rank = Rank[0].Rank;
						} else {
							Rank = 10000;
						}
						var data = {
							GrpId: oAddGroup.groupId,
							GrpName: oGroup.groupName,
							AssignmentId: oAddGroup.Assignments[i].AssignmentId,
							GrpOperation: 'C',
							Rank: Rank
						};
						oGroupData.push(data);
					}
				}
				if (oDeleteGroup.Assignments) {

					for (var i = 0; i < oDeleteGroup.Assignments.length; i++) {
						var Rank = $.grep(oGroup.Assignments, function (element) {
							return oDeleteGroup.Assignments[i].AssignmentId === element.AssignmentId;
						});
						if (Rank.length > 0) {
							Rank = Rank[0].Rank;
						} else {
							Rank = 10000;
						}
						var data = {
							GrpId: oDeleteGroup.groupId,
							GrpName: oGroup.groupName,
							AssignmentId: oDeleteGroup.Assignments[i].AssignmentId,
							GrpOperation: 'D',
							Rank: Rank
						};
						oGroupData.push(data);
					}
				}

			} else if (oControl.getProperty('/createGroup') === true) {

				for (var i = 0; i < oAddGroup.Assignments.length; i++) {
					if (oAddGroup.Assignments) {
						var Rank = $.grep(oGroup.Assignments, function (element) {
							return oAddGroup.Assignments[i].AssignmentId === element.AssignmentId;
						});

						if (Rank.length > 0) {
							Rank = Rank[0].Rank;
						} else {
							Rank = 10000;
						}
						var data = {
							GrpId: "",
							GrpName: oGroup.groupName,
							AssignmentId: oAddGroup.Assignments[i].AssignmentId,
							GrpOperation: 'C',
							Rank: Rank
						};
						oGroupData.push(data);
					}
				}

			}
			oControl.setProperty('/DeleteGroup', false);

			that.setGlobalModel(oControl, "controls");
			that.SubmitGroup(oGroupData);

		},
		SubmitGroup: function (GroupData) {
			var that = this;
			var oModel = $.extend(true, {}, this.oDataModel);
			oModel.setChangeBatchGroups({
				"*": {
					groupId: "TimeGroup",
					changeSetId: "TimeGroup",
					single: false
				}
			});
			oModel.setDeferredGroups(["TimeGroup"]);
			oModel
				.refreshSecurityToken(
					function (oData) {
						for (var i = 0; i < GroupData.length; i++) {
							var obj = {
								properties: GroupData[i],
								changeSetId: "TimeGroup",
								groupId: "TimeGroup"
							};
							oModel
								.createEntry(
									"/AssignmentGrpsSet",
									obj);
						}
						oModel.submitChanges({
							groupId: "TimeGroup",
							changeSetId: "TimeGroup",
							success: function (oData, res) {
								if (!oData.__batchResponses[0].__changeResponses) {
									sap.ui.getCore().getMessageManager().removeAllMessages();
									sap.ui.getCore().getMessageManager().addMessages(
										new sap.ui.core.message.Message({
											message: JSON.parse(oData.__batchResponses[0].response.body).error.message.value,
											description: JSON.parse(oData.__batchResponses[0].response.body).error.message.value,
											type: sap.ui.core.MessageType.Error,
											processor: that.getOwnerComponent().oMessageProcessor
										}));
									that.hideBusy(true);
									return;
								}
								var oControls = that.getGlobalModel("controls");
								oControls.setProperty('/groupReload', true);
								that.setGlobalModel(oControls, "controls");
								that.setModel(new JSONModel({}), "AddAssignments");
								that.setModel(new JSONModel({}), "DeleteAssignments");
								// that.oRouter.navTo("worklist", {}, true);
								if (that.getModel("createGroup").getData().Assignments.length < 1) {
									that.setGlobalModel(new JSONModel(that.getModel("createGroup").getData()), "assignmentGroupWithNoAssignment");
								} else {
									that.setGlobalModel(new JSONModel({}), "assignmentGroupWithNoAssignment");
								}
								that.getRouter().navTo("worklist", {}, true);
								// return;

								// }
							},
							error: function (oError) {
								that.oErrorHandler.processError(oError);
							}
						});

					}, true);
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
			this.oMessagePopover.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
			// }

			this.oMessagePopover.toggle(oEvent.getSource());

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
		// onGroupDeleteConfirm: function (oEvent) {
		// 	this.showConfirmBox(oEvent, this.onGroupDelete.bind(this));
		// },
		onGroupDeleteConfirm: function (oEvent) {
			var that = this;
			var messageHeader = that.oBundle.getText("confirmationDeleteGroup");
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			sap.m.MessageBox.warning(
				messageHeader, {
					title: that.oBundle.getText("delete"),
					actions: [sap.m.MessageBox.Action.DELETE, sap.m.MessageBox.Action.CANCEL],
					styleClass: bCompact ? "sapUiSizeCompact" : "",
					onClose: function (sAction) {
						if (sAction === "DELETE") {
							that.onGroupDelete();
						}
					}
				}
			);
		},
		onGroupDelete: function (oEvent) {
			var that = this;
			var oGroup = this.getModel("createGroup").getData();
			var oGroupData = [];
			if (oGroup.Assignments) {
				for (var i = 0; i < oGroup.Assignments.length; i++) {
					var data = {
						GrpId: oGroup.groupId,
						GrpName: oGroup.groupName,
						AssignmentId: oGroup.Assignments[i].AssignmentId,
						GrpOperation: 'D'
					};
					oGroupData.push(data);
				}
			}
			var oControls = that.getGlobalModel("controls");
			oControls.setProperty('/DeleteGroup', true);
			that.setGlobalModel(oControls, "controls");
			this.SubmitGroup(oGroupData);
		}

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