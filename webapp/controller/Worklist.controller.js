/*
 * Copyright (C) 2009-2020 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/mytimesheet/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"hcm/fab/mytimesheet/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/m/TablePersoController",
	"sap/m/GroupHeaderListItem",
	"sap/ui/core/Fragment",
	"sap/m/Dialog",
	"sap/m/Text",
	"hcm/fab/mytimesheet/util/CommonModelManager"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessagePopover, MessagePopoverItem,
	TablePersoController, GroupHeaderListItem, Fragment, Dialog, Text, CommonModelManager) {
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

	return BaseController.extend("hcm.fab.mytimesheet.controller.Worklist", {

		formatter: formatter,
		extHookChangeObjectBeforeSubmit: null,
		extHookOnEditOverview: null,
		extHookOnEditTodo: null,
		extHookReadOnlyOverview: null,
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			this.oDataModel = this.getOwnerComponent().getModel();
			this.oCEModel = this.getOwnerComponent().getModel("ce");
			this.oBundle = this.getResourceBundle();
			this.oErrorHandler = this.getOwnerComponent()._oErrorHandler;
			this.initoDataModel(this.oDataModel);
            this.initcoDataModel(this.oCEModel);
			this.initoBundle(this.oBundle);
			this.initRouter(this.getRouter());
			this.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
			this.empId = null;
			this._nCounter = 0;
			this.oFormatYyyymmdd = sap.ui.core.format.DateFormat.getInstance({
				pattern: "yyyy-MM-dd",
				calendarType: sap.ui.core.CalendarType.Gregorian
			});
			this.oFormatyyyymmdd = sap.ui.core.format.DateFormat.getInstance({
				pattern: "yyyyMMdd",
				calendarType: sap.ui.core.CalendarType.Gregorian
			});
			this.oFormatDate = sap.ui.core.format.DateFormat.getInstance({
				style: "full",
				calendarType: sap.ui.core.CalendarType.Gregorian
			});
			this.oFormatDateMedium = sap.ui.core.format.DateFormat.getInstance({
				style: "medium",
				calendarType: sap.ui.core.CalendarType.Gregorian
			});
			// Handle validation
			sap.ui.getCore().attachParseError(controlErrorHandler);
			sap.ui.getCore().attachValidationSuccess(controlNoErrorHandler);
			this.busyDialog = new sap.m.BusyDialog();
			this.oRouter = this.getOwnerComponent().getRouter();
			this.calendar = this.byId("idCalendar");
			this.mCalendar = this.byId("mCalendar");
			this.oTable = this.byId("idOverviewTable");
			this.oTaskTable = this.byId("idTasks");
			this.oToDoTable = this.byId("idToDoList");
			var localeObj = new sap.ui.getCore().getConfiguration(); //Creating locale Object
			this.localeLanguage = localeObj.getLocale().getLanguage();

			this.hoursDisabled = false;
			this.oRouter.getRoute("worklist").attachMatched(this.worklistRouteMatched.bind(this), this);
			var data = [];
			var oModel = new JSONModel();
			oModel.setData(data);
			this.setModel(oModel, "deleteRecords");
			this.setModel(oModel, "changedRecords");
			this.setModel(oModel, "newRecords");
			this.updatedRecords = [];
			this.originalTimedata = [];
			this.newRecords = [];
			this.deleteRecords = [];
			var curDate = new Date();
			var firstdate = this.byId("idCalendar").getStartDate();
			firstdate.setMonth(curDate.getMonth() - 1, 1);
			this.dateFrom = this.getFirstDayOfWeek(new Date(firstdate), 0);
			curDate = new Date();
			curDate.setMonth(curDate.getMonth() + 3, 0);
			this.dateTo = curDate;
			this.calendar.destroySelectedDates();
			this.startdate = this.getFirstDayOfWeek(new Date(), 0);
			this.enddate = this.getLastDayOfWeek(new Date(), 0);
			this.prestartdate = this.startdate;
			this.preenddate = this.enddate;
			this.renderFieldTexts = [];
			this.fieldTextFetchedAsync = {};
			var selectedDates = new sap.ui.unified.DateRange();
			selectedDates.setStartDate(this.startdate);
			selectedDates.setEndDate(this.enddate);
			if (sap.ui.Device.resize.width <= 1536) {
				this.byId("idCalendar").setWidth();
			} else {
				this.byId("idCalendar").setWidth("100%");
			}
			var LastSelectDateModel = new JSONModel({
				preSelect: this.startdate,
				endSelect: this.enddate
			});
			this.setModel(LastSelectDateModel, "lastSelectModel");
			var controlModel = new JSONModel({
				showFooter: false,
				submitDraft: false,
				sendForApproval: false,
				sendForApprovalCheck: false,
				clockEntry: false,
				overviewCancel: false,
				todoCancel: false,
				todoDone: false,
				todoDoneCheck: false,
				taskEdit: false,
				taskDelete: false,
				taskCopy: false,
				duplicateVisibility: false,
				duplicateWeekVisibility: false,
				duplicateScreen: false,
				onEdit: "None",
				duplicateTaskEnable: false,
				duplicateWeekEnable: true,
				editLongTextEnabled: false,
				feedListVisibility: false,
				firstDayOfWeek: 0,
				isGroup: false,
				startDate: selectedDates,
				createAssignment: false,
				copyAssignment: false,
				displayAssignment: false,
				displayAssignmentCancel: false,
				editAssignment: false,
				assignmentTitle: null,
				tasksActiveLength: null,
				tasksInactiveLength: null,
				clockTimeVisible: false,
				previousDayIndicator: false,
				previousDayIndicatorEdit: false,
				editTodoVisibility: false,
				numberOfRecords: 0,
				overviewEditEnabled: true,
				importAssignment: true,
				showFooterAssignment: false,
				importWorklist: false,
				approverAllowed: false,
				displayGroup: false,
				groupReload: false,
				createGroup: false,
				EditGroup: false,
				DeleteGroup: false,
				createGroupSave: false,
				isOverviewChanged: false,
				isToDoChanged: false,
				overviewDataChanged: false,
				overviewDataChangedWithCheck: false,
				todoDataChanged: false,
				todoDataChangedWithCheck: false,
				//message change
				// showOverviewMessage: false,
				// showAssignmentsMessage: true,
				// showGroupMessage: true,
				// showOverviewMessageWithRange: false,
				// showToDoListMessageWithRange: false,
				// showAssignmentGroupsMessageWithRange: false,
				// showAssignementMessageWithRange: false,
				showInformationMessage: false,
				showInformationMessageWithRange: false,
				showAssignmentsMessage: false,
				showAssignementMessageWithRange: false,
				showGroupMessage: false,
				informationVisible: true,
				duplicateTaskButtonEnable: false,
				duplicateWeekButtonEnable: false,
				hoursDisabled: false,
				isDailyView: false,
				totalTarget: false,
				targetCopyButtonEnabled: false,
				assignmentClockTime: false,
				showEmployeeNumber: true,
				showEmployeeNumberWithoutZeros: false,
				fixProgressIndicator: false,
				adHocEnabled: false,
				adHocDisplayed: false,
				adHocEdit: false,
				currentAdHoc: false,
				adHocUpdate: false,
				adHocCreate: false,
				intervalSelection: true,
				singleSelection: true,
				singleAdHocDay: false,
				isOlderMultipleDays: false,
				currentTodo: false,
				currentTodoAdHoc: false,
				isFormEntryEnabled: false,
				isDraftEnabled: false,
				previousDayAdHoc: '',
				adHocDraftSelected: false,
				adHocTodoDraftSelected: false,
				adHocPreviousDaySelected: false,
				adHocTodoPreviousDaySelected: false

			});
			if (sap.ui.Device.system.phone === true) {
				controlModel.isGroup = true;
			}
			this.setModel(controlModel, "controls");
			this.calendar.addSelectedDate(selectedDates);
			// Handle validation
			sap.ui.getCore().attachParseError(controlErrorHandler);
			sap.ui.getCore().attachValidationSuccess(controlNoErrorHandler);
			sap.ui.getCore().getMessageManager().registerObject(this.getView(), true);
			sap.ui.Device.resize.attachHandler(this.resizeWindow.bind(this));
			this.filterAppliedFlag = "";
			this.setModel(new JSONModel({
				TotalHours: 0,
				TargetHours: 0,
				ToolTipText: ""
			}), "TotalHours");
			this.setModel(new JSONModel({
				ApprovedLeave: this.oBundle.getText("ApprovedLeave"),
				assignmentSelection: this.oBundle.getText("assignmentSelection"),
				noAssignment: this.oBundle.getText("noAssignment")

			}), "textBundle");
			//method focusDate() available from SAP UI5 version 1.71 and above
			var version = sap.ui.version;
			version = version.split(".");
			if (version[0] >= 1 && version[1] >= 71) {
				//set focus of calendar to last month
				var focusCalendarDate = new Date();
				focusCalendarDate.setDate(focusCalendarDate.getDate() - (focusCalendarDate.getDate() + 1));
				this.calendar.focusDate(focusCalendarDate);
			}
			// this.intervalHandle = setInterval(function () {
			// 	that.renderTexts();
			// }, 10000);

			// determine default assignment
			CommonModelManager.getDefaultAssignment("MYTIMESHEET").then(function (oAssignment) {
				this._changeAssignment(oAssignment.EmployeeId, true);
			}.bind(this));

			if (sap.ui.Device.system.phone) {
				this.getModel("controls").setProperty("/showFooter", true);
				this.getModel("controls").setProperty("/overviewEdit", true);
				this.getModel("controls").setProperty("/editTodoVisibility", false);

			}
			//Destroying Initially loaded messages
			var that = this;
			this.byId("InitialOverviewMessageStrip").attachClose(function () {
				that.getModel('controls').setProperty('/informationVisible', false);
				that.byId("InitialOverviewMessageStrip").destroy();
				that.byId("InitialToDoListMessageStrip").destroy();
				try {
					if (sap.ui.Device.system.phone === false) {
						that.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
					}
				} catch (exception) {

				}
				//that.byId("InitialAssignmentGroupsMessageStrip").destroy();
			});
			this.byId("InitialToDoListMessageStrip").attachClose(function () {
				that.getModel('controls').setProperty('/informationVisible', false);
				that.byId("InitialOverviewMessageStrip").destroy();
				that.byId("InitialToDoListMessageStrip").destroy();
				try {
					if (sap.ui.Device.system.phone === false) {
						that.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
					}
				} catch (exception) {

				}
				//	that.byId("InitialAssignmentGroupsMessageStrip").destroy();
			});
			this.byId("InitialAssignmentsMessageStrip").attachClose(function () {
				that.getModel('controls').setProperty('/informationVisible', false);
				that.byId("InitialAssignmentsMessageStrip").destroy();
				try {
					if (sap.ui.Device.system.phone === false) {
						that.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
					}
				} catch (exception) {

				}
			});
			this.byId("InitialAssignmentGroupsMessageStrip").attachClose(function () {
				that.getModel('controls').setProperty('/informationVisible', false);
				//	that.byId("InitialOverviewMessageStrip").destroy();
				//	that.byId("InitialToDoListMessageStrip").destroy();
				that.byId("InitialAssignmentGroupsMessageStrip").destroy();
				try {
					if (sap.ui.Device.system.phone === false) {
						that.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
					}
				} catch (exception) {

				}
			});
			//Destroying messages with range
			this.byId("OverviewMessageStrip").attachClose(function () {
				that.getModel('controls').setProperty('/informationVisible', false);
				that.byId("OverviewMessageStrip").destroy();
				that.byId("ToDoListMessageStrip").destroy();
				that.byId("AssignmentGroupsMessageStrip").destroy();
				try {
					if (sap.ui.Device.system.phone === false) {
						that.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
					}
				} catch (exception) {

				}
			});
			this.byId("ToDoListMessageStrip").attachClose(function () {
				that.getModel('controls').setProperty('/informationVisible', false);
				that.byId("OverviewMessageStrip").destroy();
				that.byId("ToDoListMessageStrip").destroy();
				that.byId("AssignmentGroupsMessageStrip").destroy();
				try {
					if (sap.ui.Device.system.phone === false) {
						that.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
					}
				} catch (exception) {

				}
			});
			this.byId("AssignmentsMessageStrip").attachClose(function () {
				that.getModel('controls').setProperty('/informationVisible', false);
				that.byId("AssignmentsMessageStrip").destroy();
				try {
					if (sap.ui.Device.system.phone === false) {
						that.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
					}
				} catch (exception) {

				}
			});
			this.byId("AssignmentGroupsMessageStrip").attachClose(function () {
				that.getModel("controls").setProperty("/informationVisible", false);
				that.byId("OverviewMessageStrip").destroy();
				that.byId("ToDoListMessageStrip").destroy();
				that.byId("AssignmentGroupsMessageStrip").destroy();
				try {
					if (sap.ui.Device.system.phone === false) {
						that.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
					}
				} catch (exception) {

				}
			});
		},
		onCheckboxSelection: function (oEvent) {
			var index = oEvent.getParameter('selectedItem').getBindingContext('TimeData').getPath().split("/")[1];
			this.getModel('TimeData').getData()[index].SetDraft = true;
			this.getModel('controls').setProperty('isOverviewChanged', true);
		},
		appendLocaleParameter: function (originalParamter) {
			return originalParamter;
		},
		hideLegend: function () {
			if (sap.ui.Device.system.phone === true) {
				var visible = this.byId("mlegend").getVisible();
				if (visible === true) {
					visible = false;
				} else {
					visible = true;
				}
				this.byId("mlegend").setVisible(visible);
			}
			return;
		},
		highlightLegend: function (data) {
			var that = this;
			// that.calendar.destroySpecialDates();
			// that.mCalendar.destroySpecialDates();
			var todaysDate = that.oFormatyyyymmdd.format(new Date());
			var missingDates = $.grep(data, function (element, index) {
				return element.Status == "MISSING";
			});
			var approvedDates = $.grep(data, function (element, index) {
				return element.Status == "DONE";
			});
			var rejectedDates = $.grep(data, function (element, index) {
				return element.Status == "REJECTED";
			});
			var sentDates = $.grep(data, function (element, index) {
				return element.Status == "FORAPPROVAL";
			});
			var draftDates = $.grep(data, function (element, index) {
				return element.Status == "DRAFT";
			});
			var nonWorkDates = $.grep(data, function (element, index) {
				return element.Status == "YACTION";
			});
			var approvedLeave = $.grep(data, function (element, index) {
				return element.Status == "";
			});
			var checkApprovedLeaveLegend = false;
			$.grep(that.byId("legend").getItems(), function (e) {
				if (e.getType() === "Type10") {
					checkApprovedLeaveLegend = true;
				}
			});
			if (approvedLeave.length > 0 && !checkApprovedLeaveLegend) {
				that.byId("legend").addItem(new sap.ui.unified.CalendarLegendItem({
					type: sap.ui.unified.CalendarDayType.Type10,
					text: that.oBundle.getText("ApprovedLeave"),
					tooltip: that.oBundle.getText("ApprovedLeave")
				}));
				that.byId("mlegend").addItem(new sap.ui.unified.CalendarLegendItem({
					type: sap.ui.unified.CalendarDayType.Type10,
					text: that.oBundle.getText("ApprovedLeave"),
					tooltip: that.oBundle.getText("ApprovedLeave")
				}));
			}
			var holiday = $.grep(data, function (element, index) {
				var holidayRe = new RegExp('HOLIDAY');
				return holidayRe.test(element.Status) == true;
			});
			var checkHolidayLegend = false;
			$.grep(that.byId("legend").getItems(), function (e) {
				if (e.getType() === "Type06") {
					checkHolidayLegend = true;
				}
			});
			if (holiday.length > 0 && !checkHolidayLegend) {
				that.byId("legend").addItem(new sap.ui.unified.CalendarLegendItem({
					type: sap.ui.unified.CalendarDayType.Type06,
					text: that.oBundle.getText("Holiday"),
					tooltip: that.oBundle.getText("Holiday")
				}));
				that.byId("mlegend").addItem(new sap.ui.unified.CalendarLegendItem({
					type: sap.ui.unified.CalendarDayType.Type06,
					text: that.oBundle.getText("Holiday"),
					tooltip: that.oBundle.getText("Holiday")
				}));
			}

			for (var i = 0; i < holiday.length; i++) {
				if (sap.ui.Device.system.phone === true) {
					that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
						startDate: holiday[i].CaleDate,
						type: sap.ui.unified.CalendarDayType.Type06,
						tooltip: holiday[i].HolidayText
					}));
				} else {
					that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
						startDate: holiday[i].CaleDate,
						type: sap.ui.unified.CalendarDayType.Type06,
						tooltip: holiday[i].HolidayText
					}));
				}
			}
			for (var i = 0; i < approvedLeave.length; i++) {
				if (sap.ui.Device.system.phone === true) {
					that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
						startDate: approvedLeave[i].CaleDate,
						type: sap.ui.unified.CalendarDayType.Type10,
						tooltip: that.oBundle.getText("ApprovedLeave")
					}));
				} else {
					that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
						startDate: approvedLeave[i].CaleDate,
						type: sap.ui.unified.CalendarDayType.Type10,
						tooltip: that.oBundle.getText("ApprovedLeave")
					}));
				}
			}

			if (sap.ui.Device.system.phone === true) {
				for (var i = 0; i < missingDates.length; i++) {
					if (that.oFormatyyyymmdd.format(new Date(missingDates[i].CaleDate)) <= todaysDate) {
						that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
							startDate: missingDates[i].CaleDate,
							type: sap.ui.unified.CalendarDayType.Type01,
							tooltip: that.oBundle.getText("timeMissing")
						}));
					}
				}
			} else {
				for (var i = 0; i < missingDates.length; i++) {
					if (that.oFormatyyyymmdd.format(new Date(missingDates[i].CaleDate)) <= todaysDate) {
						that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
							startDate: missingDates[i].CaleDate,
							type: sap.ui.unified.CalendarDayType.Type01,
							tooltip: that.oBundle.getText("timeMissing")
						}));
					}
				}
			}
			if (sap.ui.Device.system.phone === true) {
				for (var i = 0; i < sentDates.length; i++) {
					that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
						startDate: sentDates[i].CaleDate,
						type: sap.ui.unified.CalendarDayType.Type07,
						tooltip: that.oBundle.getText("SentForApproval")
					}));
				}
			} else {
				for (var i = 0; i < sentDates.length; i++) {
					that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
						startDate: sentDates[i].CaleDate,
						type: sap.ui.unified.CalendarDayType.Type07,
						tooltip: that.oBundle.getText("SentForApproval")
					}));
				}
			}

			if (sap.ui.Device.system.phone === true) {
				for (var i = 0; i < approvedDates.length; i++) {
					that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
						startDate: approvedDates[i].CaleDate,
						type: sap.ui.unified.CalendarDayType.Type08,
						tooltip: that.oBundle.getText("timeCompleted")
					}));
				}
			} else {
				for (var i = 0; i < approvedDates.length; i++) {
					that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
						startDate: approvedDates[i].CaleDate,
						type: sap.ui.unified.CalendarDayType.Type08,
						tooltip: that.oBundle.getText("timeCompleted")
					}));
				}
			}
			if (sap.ui.Device.system.phone === true) {
				for (var i = 0; i < rejectedDates.length; i++) {
					that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
						startDate: rejectedDates[i].CaleDate,
						type: sap.ui.unified.CalendarDayType.Type03,
						tooltip: that.oBundle.getText("timeRejected")
					}));
				}
			} else {
				for (var i = 0; i < rejectedDates.length; i++) {
					that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
						startDate: rejectedDates[i].CaleDate,
						type: sap.ui.unified.CalendarDayType.Type03,
						tooltip: that.oBundle.getText("timeRejected")
					}));
				}
			}
			if (sap.ui.Device.system.phone === true) {
				if (sap.ui.unified.CalendarDayType.NonWorking !== undefined) {
					for (var i = 0; i < nonWorkDates.length; i++) {
						that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
							startDate: nonWorkDates[i].CaleDate,
							type: sap.ui.unified.CalendarDayType.NonWorking
								//tooltip: that.oBundle.getText("timeMissing")
						}));
					}
				}
			} else {
				if (sap.ui.unified.CalendarDayType.NonWorking !== undefined) {
					for (var i = 0; i < nonWorkDates.length; i++) {
						that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
							startDate: nonWorkDates[i].CaleDate,
							type: sap.ui.unified.CalendarDayType.NonWorking
								//tooltip: that.oBundle.getText("timeMissing")
						}));
					}
				}
			}

		},

		getTimeEntriesOnDemand: function (dateFrom, dateTo, isMultipleDates) {
			//Fetching entries for single date on demand
			var that = this;
			if (!dateTo) {
				dateTo = new Date(dateFrom);
				dateTo.setHours(0, 0, 0, 0);
			}
			return new Promise(function (fnResolve, fnReject) {
				var oModel = new sap.ui.model.json.JSONModel();

				that.oFormatYyyymmdd = sap.ui.core.format.DateFormat.getInstance({
					pattern: "yyyy-MM-dd",
					calendarType: sap.ui.core.CalendarType.Gregorian
				});

				var a = new sap.ui.model.Filter({
					path: "StartDate",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.oFormatYyyymmdd.format(dateFrom)
				});
				var b = new sap.ui.model.Filter({
					path: "EndDate",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.oFormatYyyymmdd.format(dateTo)
				});
				var c = new sap.ui.model.Filter({
					path: "Pernr",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.empID
				});

				var f = [];
				f.push(a);
				f.push(b);
				f.push(c);
				if (that.profileId) {
					var d = new sap.ui.model.Filter({
						path: "ProfileId",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: that.profileId
					});
					if (that.profileId !== undefined) {
						f.push(d);
					}
				}

				var mParameters = {
					filters: f,
					urlParameters: '$expand=TimeEntries',
					success: function (oData, oResponse) {
						//Setting the model for on demand
						if (!isMultipleDates) {
							that.setModel(new JSONModel(oData.results), 'onDemand');
							fnResolve(that.getModel('onDemand').getData());
						} else {
							//for multiple dates set the legend color

							var data = oData.results;
							//Setting proper date format
							for (var i = 0; i < data.length; i++) {
								data[i].CaleDate = new Date(data[i].CaleDate.substring(0, 4) + "-" + data[i].CaleDate.substring(
										4,
										6) + "-" +
									data[i].CaleDate.substring(6, 8));
								data[i].CaleDate = new Date(data[i].CaleDate.getUTCFullYear(), data[i].CaleDate.getUTCMonth(),
									data[i].CaleDate.getUTCDate());
								for (var j = 0; j < data[i].TimeEntries.results.length; j++) {
									data[i].TimeEntries.results[j].TimeEntryDataFields.WORKDATE = new Date(data[i].TimeEntries.results[
											j]
										.TimeEntryDataFields
										.WORKDATE.getUTCFullYear(), data[i].TimeEntries.results[j].TimeEntryDataFields.WORKDATE.getUTCMonth(), data[i].TimeEntries
										.results[j].TimeEntryDataFields.WORKDATE.getUTCDate());

								}
								var date = new Date(data[i].CaleDate);
								date.setHours(0, 0, 0, 0);
								that.adHocDemandEntries[date.getTime()] = data[i];

							}
							that.highlightLegend(data);
							fnResolve({});

						}
					},
					error: function (oError) {
						that.hideBusy(true);
						that.oErrorHandler.processError(oError);
					}

				};

				///Check for promise fulfilling	
				that.oDataModel.read(that.appendLocaleParameter('/WorkCalendarCollection'), mParameters);
			}.bind(this));

		},

		getTimeEntries: function (dateFrom, dateTo) {
			var that = this;
			var oModel = new sap.ui.model.json.JSONModel();
			var a = new sap.ui.model.Filter({
				path: "StartDate",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.oFormatYyyymmdd.format(dateFrom)
			});
			var b = new sap.ui.model.Filter({
				path: "EndDate",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.oFormatYyyymmdd.format(dateTo)
			});
			var c = new sap.ui.model.Filter({
				path: "Pernr",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.empID
			});

			var f = [];
			f.push(a);
			f.push(b);
			f.push(c);
			if (that.profileId) {
				var d = new sap.ui.model.Filter({
					path: "ProfileId",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.profileId
				});
				if (that.profileId !== undefined) {
					f.push(d);
				}
			}
			var mParameters = {
				filters: f, // your Filter Array
				urlParameters: '$expand=TimeEntries',
				success: function (oData, oResponse) {
					that.timeEntries = oData.results;
					for (var i = 0; i < that.timeEntries.length; i++) {
						that.timeEntries[i].CaleDate = new Date(that.timeEntries[i].CaleDate.substring(0, 4) + "-" + that.timeEntries[i].CaleDate.substring(
								4,
								6) + "-" +
							that.timeEntries[i].CaleDate.substring(6, 8));
						that.timeEntries[i].CaleDate = new Date(that.timeEntries[i].CaleDate.getUTCFullYear(), that.timeEntries[i].CaleDate.getUTCMonth(),
							that.timeEntries[i].CaleDate.getUTCDate());
						for (var j = 0; j < that.timeEntries[i].TimeEntries.results.length; j++) {
							that.timeEntries[i].TimeEntries.results[j].TimeEntryDataFields.WORKDATE = new Date(that.timeEntries[i].TimeEntries.results[j]
								.TimeEntryDataFields
								.WORKDATE.getUTCFullYear(), that.timeEntries[i].TimeEntries.results[j].TimeEntryDataFields.WORKDATE.getUTCMonth(), that.timeEntries[
									i].TimeEntries.results[j].TimeEntryDataFields.WORKDATE.getUTCDate());
							// if (that.timeEntries[i].TimeEntries.results[j].TimeEntryDataFields.BEGUZ !== "000000") {
							// 	if (that.timeEntries[i].TimeEntries.results[j].TimeEntryDataFields.ENDUZ === "000000") {
							// 		that.timeEntries[i].TimeEntries.results[j].TimeEntryDataFields.ENDUZ = "240000";
							// 	}
							// }
							// if (that.timeEntries[i].TimeEntries.results[j].TimeEntryDataFields.ENDUZ !== "000000") {
							// 	if (that.timeEntries[i].TimeEntries.results[j].TimeEntryDataFields.BEGUZ === "000000") {
							// 		that.timeEntries[i].TimeEntries.results[j].TimeEntryDataFields.BEGUZ = "240000";
							// 	}
							// }
						}
					}
					that.minDate = new Date(oData.results[0].CaleNavMinDate.getUTCFullYear(), oData.results[0].CaleNavMinDate.getUTCMonth(), oData.results[
						0].CaleNavMinDate.getUTCDate());
					that.maxDate = new Date(oData.results[0].CaleNavMaxDate.getUTCFullYear(), oData.results[0].CaleNavMaxDate.getUTCMonth(), oData.results[
						0].CaleNavMaxDate.getUTCDate());
					that.minFocusDate = new Date(that.minDate);
					that.maxFocusDate = new Date(that.maxDate);

					var firstDayOfWeek = new JSONModel({
						"day": formatter.dayOfWeek(oData.results[0].FirstDayOfWeek)
					});
					that.setGlobalModel(firstDayOfWeek, "firstDayOfWeek");

					if (sap.ui.Device.system.phone === false) {

						var day = formatter.dayOfWeek(oData.results[0].FirstDayOfWeek);

						if (that.minDate.getTime() !== that.getFirstDayOfWeek(that.minDate, day).getTime()) {
							var hours = that.timeEntries[0].CaleNavMinDate.getHours();
							var minutes = that.timeEntries[0].CaleNavMinDate.getMinutes();
							var seconds = that.timeEntries[0].CaleNavMinDate.getSeconds();
							var milliSeconds = that.timeEntries[0].CaleNavMinDate.getMilliseconds();
							var newMinDate = new Date(that.minDate);
							if (that.dailyView !== "X") {
								newMinDate.setDate(newMinDate.getDate() + 7);
								that.timeEntries[0].CaleNavMinDate = new Date(that.getFirstDayOfWeek(newMinDate, day)); //Setting the minDate as FirstDay Of Week
								that.minFocusDate = new Date(that.getFirstDayOfWeek(newMinDate, day));
								that.minFocusDate.setHours(0, 0, 0, 0);

							}
							that.timeEntries[0].CaleNavMinDate.setHours(hours, minutes, seconds, milliSeconds);
						}
						that.nextEnabled = true;

						if (that.maxDate.getTime() !== that.getLastDayOfWeek(that.maxDate, day).getTime()) {
							var hours = that.timeEntries[0].CaleNavMaxDate.getHours();
							var minutes = that.timeEntries[0].CaleNavMaxDate.getMinutes();
							var seconds = that.timeEntries[0].CaleNavMaxDate.getSeconds();
							var milliSeconds = that.timeEntries[0].CaleNavMaxDate.getMilliseconds();
							var newMaxDate = new Date(that.maxDate);
							if (that.dailyView !== "X") {
								newMaxDate.setDate(newMaxDate.getDate() - 7);
								that.timeEntries[0].CaleNavMaxDate = new Date(that.getLastDayOfWeek(newMaxDate, day)); //Setting the maxDate as LastDay Of Week
								that.maxFocusDate = new Date(that.getLastDayOfWeek(newMaxDate, day));
								that.maxFocusDate.setHours(0, 0, 0, 0);

							}
							that.timeEntries[0].CaleNavMaxDate.setHours(hours, minutes, seconds, milliSeconds);
						}
						if (((that.timeEntries[0].CaleNavMinDate.getYear() === that.calendar.getAggregation("month")[0].getDate().getMonth()) && (
								that.timeEntries[
									0].CaleNavMinDate.getMonth() >= that.calendar.getAggregation("month")[0].getDate().getMonth())) || that.timeEntries[0].CaleNavMinDate
							.getYear() > that.calendar.getAggregation("month")[0].getDate().getYear()) {
							that.calendar.getAggregation("header").setEnabledPrevious(false);
						}
						if (((that.timeEntries[0].CaleNavMaxDate.getYear() === that.calendar.getAggregation("month")[1].getDate().getYear()) && (that.timeEntries[
								0].CaleNavMaxDate.getMonth() <= that.calendar.getAggregation("month")[1].getDate().getMonth())) || that.timeEntries[0].CaleNavMaxDate
							.getYear() < that.calendar.getAggregation("month")[1].getDate().getYear()) {
							var todaysDate = new Date();
							//Explicit handling in the case of current month has max data
							if (todaysDate.getMonth() === that.timeEntries[0].CaleNavMaxDate.getMonth() && todaysDate.getMonth() === that.calendar.getAggregation(
									"month")[1].getDate().getMonth()) {
								that.calendar.getAggregation("header").setEnabledNext(true);
							} else {
								that.calendar.getAggregation("header").setEnabledNext(false);
								that.nextEnabled = false;

							}
						}
					}

					oModel.setData(that.timeEntries);
					that.setModel(oModel, "TimeEntries");
					if (that.firstDayOfWeek == undefined || that.profileSwitched === true) {
						that.profileSwitched = false;
						that.firstDayOfWeek = formatter.dayOfWeek(that.timeEntries[0].FirstDayOfWeek);
						var curDate = new Date();
						var firstdate = that.byId('idCalendar').getStartDate();
						firstdate.setMonth(curDate.getMonth() - 1, 1);
						that.dateFrom = that.getFirstDayOfWeek(new Date(firstdate), that.firstDayOfWeek);
						curDate = new Date();
						curDate.setMonth(curDate.getMonth() + 3, 0);
						that.dateTo = curDate;
						that.calendar.destroySelectedDates();
						if (sap.ui.Device.system.phone === true) {
							var dateStartDate = that.getFirstDayOfWeek(new Date(), that.firstDayOfWeek);
							that.mCalendar.setStartDate(dateStartDate);
							that.startdate = new Date();
							that.enddate = new Date();
						} else if (that.dailyView === "X") {
							that.startdate = new Date();
							that.enddate = new Date();
						} else {
							that.startdate = that.getFirstDayOfWeek(new Date(), that.firstDayOfWeek);
							that.enddate = that.getLastDayOfWeek(new Date(), that.firstDayOfWeek);
							var oDateModel = that.getModel("lastSelectModel").getData();
							oDateModel.preSelect = that.startdate;
							oDateModel.endSelect = that.enddate;
							that.getModel("lastSelectModel").refresh();
						}

					}

					// if (that.timeEntries[0].CaleNavMinDate < that.getFirstDayOfWeek(that.startdate))
					// if (that.profileSwitched || !that.getModel('TimeData')) {
					// 	that.bindTable(new Date(that.startdate), new Date(that.enddate));
					// 	that.initialLoad = true;

					// }
					// if (sap.ui.Device.system.phone === true) {
					// 	that.bindTable(new Date(that.startdate), new Date(that.enddate));

					// } else if (that.profileSwitched || !that.getModel('TimeData')) {
					// 	that.bindTable(new Date(that.startdate), new Date(that.enddate));
					// 	that.initialLoad = true;

					// }

					that.bindTable(new Date(that.startdate), new Date(that.enddate));

					if (that.oReadOnlyTemplate) {
						that.rebindTableWithTemplate(that.oTable, "TimeData>/", that.oReadOnlyTemplate, "Navigation");
						that.getEnteredHours(false);
					}

					if (sap.ui.Device.system.phone === true) {

						var dateStartDate = that.getFirstDayOfWeek(that.startdate, that.firstDayOfWeek);
						that.mCalendar.setStartDate(dateStartDate);
						that.calendarSelection(that.mCalendar, that.startdate, that.enddate);

					} else if (that.dailyView === "X") {

						if (that.timeEntries[0].CaleNavMinDate >= that.getFirstDayOfWeek(that.startdate, day)) {
							that.calendarSelection(that.calendar, that.timeEntries[0].CaleNavMinDate, that.timeEntries[0].CaleNavMinDate);
							// that.bindTable(new Date(that.timeEntries[0].CaleNavMinDate), new Date(that.timeEntries[0].CaleNavMinDate)); //No need to bind it because startdate and enddate have been adjusted inside on startdate change
						} else {
							that.calendarSelection(that.calendar, that.startdate, that.enddate);
						}

					} else {

						//	that.bindTable(new Date(that.startdate), new Date(that.enddate));

						if (that.timeEntries[0].CaleNavMinDate >= that.getFirstDayOfWeek(that.startdate, day)) {
							that.calendarSelection(that.calendar, that.timeEntries[0].CaleNavMinDate, that.getLastDayOfWeek(that.timeEntries[0].CaleNavMinDate,
								day));
							// that.bindTable(new Date(that.timeEntries[0].CaleNavMinDate), new Date(that.getLastDayOfWeek(that.timeEntries[0].CaleNavMinDate,
							// 	day)));//No need to bind it because startdate and enddate have been adjusted inside on startdate change

						} else {

							that.calendarSelection(that.calendar, that.startdate, that.enddate);
						}

					}
					that.calendar.destroySpecialDates();
					that.calendar.setNonWorkingDays([]);
					that.mCalendar.destroySpecialDates();
					that.mCalendar.setNonWorkingDays([]);
					var todaysDate = that.oFormatyyyymmdd.format(new Date());
					var missingDates = $.grep(that.timeEntries, function (element, index) {
						return element.Status == "MISSING";
					});
					var approvedDates = $.grep(that.timeEntries, function (element, index) {
						return element.Status == "DONE";
					});
					var rejectedDates = $.grep(that.timeEntries, function (element, index) {
						return element.Status == "REJECTED";
					});
					var sentDates = $.grep(that.timeEntries, function (element, index) {
						return element.Status == "FORAPPROVAL";
					});
					var draftDates = $.grep(that.timeEntries, function (element, index) {
						return element.Status == "DRAFT";
					});
					var nonWorkDates = $.grep(that.timeEntries, function (element, index) {
						return element.IsWorkingDay == "FALSE";
					});
					var approvedLeave = $.grep(that.timeEntries, function (element, index) {
						return element.Status == "";
					});
					var checkApprovedLeaveLegend = false;
					$.grep(that.byId("legend").getItems(), function (e) {
						if (e.getType() === "Type10") {
							checkApprovedLeaveLegend = true;
						}
					});
					if (approvedLeave.length > 0 && !checkApprovedLeaveLegend) {
						that.byId("legend").addItem(new sap.ui.unified.CalendarLegendItem({
							type: sap.ui.unified.CalendarDayType.Type10,
							text: that.oBundle.getText("ApprovedLeave"),
							tooltip: that.oBundle.getText("ApprovedLeave")
						}));
						that.byId("mlegend").addItem(new sap.ui.unified.CalendarLegendItem({
							type: sap.ui.unified.CalendarDayType.Type10,
							text: that.oBundle.getText("ApprovedLeave"),
							tooltip: that.oBundle.getText("ApprovedLeave")
						}));
					}
					var holiday = $.grep(that.timeEntries, function (element, index) {
						var holidayRe = new RegExp('HOLIDAY');
						return holidayRe.test(element.Status) == true;
					});
					var checkHolidayLegend = false;
					$.grep(that.byId("legend").getItems(), function (e) {
						if (e.getType() === "Type06") {
							checkHolidayLegend = true;
						}
					});
					if (holiday.length > 0 && !checkHolidayLegend) {
						that.byId("legend").addItem(new sap.ui.unified.CalendarLegendItem({
							type: sap.ui.unified.CalendarDayType.Type06,
							text: that.oBundle.getText("Holiday"),
							tooltip: that.oBundle.getText("Holiday")
						}));
						that.byId("mlegend").addItem(new sap.ui.unified.CalendarLegendItem({
							type: sap.ui.unified.CalendarDayType.Type06,
							text: that.oBundle.getText("Holiday"),
							tooltip: that.oBundle.getText("Holiday")
						}));
					}

					for (var i = 0; i < holiday.length; i++) {
						if (sap.ui.Device.system.phone === true) {
							that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
								startDate: holiday[i].CaleDate,
								type: sap.ui.unified.CalendarDayType.Type06,
								tooltip: holiday[i].HolidayText
							}));
						} else {
							that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
								startDate: holiday[i].CaleDate,
								type: sap.ui.unified.CalendarDayType.Type06,
								tooltip: holiday[i].HolidayText
							}));
						}
					}
					for (var i = 0; i < approvedLeave.length; i++) {
						if (sap.ui.Device.system.phone === true) {
							that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
								startDate: approvedLeave[i].CaleDate,
								type: sap.ui.unified.CalendarDayType.Type10,
								tooltip: that.oBundle.getText("ApprovedLeave")
							}));
						} else {
							that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
								startDate: approvedLeave[i].CaleDate,
								type: sap.ui.unified.CalendarDayType.Type10,
								tooltip: that.oBundle.getText("ApprovedLeave")
							}));
						}
					}

					if (sap.ui.Device.system.phone === true) {
						for (var i = 0; i < missingDates.length; i++) {
							if (that.oFormatyyyymmdd.format(new Date(missingDates[i].CaleDate)) <= todaysDate) {
								that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
									startDate: missingDates[i].CaleDate,
									type: sap.ui.unified.CalendarDayType.Type01,
									tooltip: that.oBundle.getText("timeMissing")
								}));
							}
						}
					} else {
						for (var i = 0; i < missingDates.length; i++) {
							if (that.oFormatyyyymmdd.format(new Date(missingDates[i].CaleDate)) <= todaysDate) {
								that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
									startDate: missingDates[i].CaleDate,
									type: sap.ui.unified.CalendarDayType.Type01,
									tooltip: that.oBundle.getText("timeMissing")
								}));
							}
						}
					}
					if (sap.ui.Device.system.phone === true) {
						for (var i = 0; i < sentDates.length; i++) {
							that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
								startDate: sentDates[i].CaleDate,
								type: sap.ui.unified.CalendarDayType.Type07,
								tooltip: that.oBundle.getText("SentForApproval")
							}));
						}
					} else {
						for (var i = 0; i < sentDates.length; i++) {
							that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
								startDate: sentDates[i].CaleDate,
								type: sap.ui.unified.CalendarDayType.Type07,
								tooltip: that.oBundle.getText("SentForApproval")
							}));
						}
					}
					//legend non-working
					if (sap.ui.Device.system.phone === true) {
						if (sap.ui.unified.CalendarDayType.NonWorking !== undefined) {
							for (var i = 0; i < nonWorkDates.length; i++) {
								that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
									startDate: nonWorkDates[i].CaleDate,
									type: sap.ui.unified.CalendarDayType.NonWorking
										//tooltip: that.oBundle.getText("timeMissing")
								}));
							}
						}
					} else {
						if (sap.ui.unified.CalendarDayType.NonWorking !== undefined) {
							for (var i = 0; i < nonWorkDates.length; i++) {
								that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
									startDate: nonWorkDates[i].CaleDate,
									type: sap.ui.unified.CalendarDayType.NonWorking
										//tooltip: that.oBundle.getText("timeMissing")
								}));
							}
						}
					}
					//legend non-working
					if (sap.ui.Device.system.phone === true) {
						for (var i = 0; i < approvedDates.length; i++) {
							that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
								startDate: approvedDates[i].CaleDate,
								type: sap.ui.unified.CalendarDayType.Type08,
								tooltip: that.oBundle.getText("timeCompleted")
							}));
						}
					} else {
						for (var i = 0; i < approvedDates.length; i++) {
							that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
								startDate: approvedDates[i].CaleDate,
								type: sap.ui.unified.CalendarDayType.Type08,
								tooltip: that.oBundle.getText("timeCompleted")
							}));
						}
					}
					if (sap.ui.Device.system.phone === true) {
						for (var i = 0; i < rejectedDates.length; i++) {
							that.mCalendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
								startDate: rejectedDates[i].CaleDate,
								type: sap.ui.unified.CalendarDayType.Type03,
								tooltip: that.oBundle.getText("timeRejected")
							}));
						}
					} else {
						for (var i = 0; i < rejectedDates.length; i++) {
							that.calendar.addSpecialDate(new sap.ui.unified.DateTypeRange({
								startDate: rejectedDates[i].CaleDate,
								type: sap.ui.unified.CalendarDayType.Type03,
								tooltip: that.oBundle.getText("timeRejected")
							}));
						}
					}
					that.getView().byId("filterCombo").setSelectedKey("100");
					that.getModel("controls").setProperty('/overviewEditEnabled', true); //Making the enter records control visible

					that.calculateChangeCount();
					that.getEnteredHours(false);

					that.hideBusy(true);
				},
				error: function (oError) {
					that.hideBusy(true);
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.read(that.appendLocaleParameter('/WorkCalendarCollection'), mParameters);
		},
		initPersonalization: function () {
			var that = this;
			try {
				if (sap.ui.Device.system.phone === false) {
					this.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
				}
			} catch (exception) {

			}
			if (sap.ushell.Container) {
				var oPersonalizationService = sap.ushell.Container.getService("Personalization");
				var oPersonalizer = oPersonalizationService.getPersonalizer({
					container: "hcm.fab.mytimesheet", // This key must be globally unique (use a key to identify the app) -> only 40 characters are allowed
					item: "idOverviewTable" // Maximum of 40 characters applies to this key as well
				});
				var oTodoPersonalizer = oPersonalizationService.getPersonalizer({
					container: "hcm.fab.mytimesheet", // This key must be globally unique (use a key to identify the app) -> only 40 characters are allowed
					item: "idToDoList" // Maximum of 40 characters applies to this key as well
				});
				var oTaskPersonalizer = oPersonalizationService.getPersonalizer({
					container: "hcm.fab.mytimesheet", // This key must be globally unique (use a key to identify the app) -> only 40 characters are allowed
					item: "idTasks" // Maximum of 40 characters applies to this key as well
				});
				if (!this.oTableTodoPersoController) {
					this.oTableTodoPersoController = new TablePersoController({
						table: this.oToDoTable,
						componentName: "MyTimesheet",
						persoService: oTodoPersonalizer
					}).activate();
				}
				this.oTableTodoPersoController.getPersoService().getPersData().done(function (data) {
					if (data) {
						try {
							var startTime = $.grep(data.aColumns, function (element, ind) {
								return element.id.split('-')[element.id.split('-').length - 1] === "todoStartTime";
							});
							var endTime = $.grep(data.aColumns, function (element, ind) {
								return element.id.split('-')[element.id.split('-').length - 1] === "todoEndTime";
							});
							var toDoPreviousDayIndicator = $.grep(data.aColumns, function (element, ind) {
								return element.id.split('-')[element.id.split('-').length - 1] === "toDoPreviousDayIndicator";
							});
							var toDoDraft = $.grep(data.aColumns, function (element, ind) {
								return element.id.split('-')[element.id.split('-').length - 1] === "draftToDo";
							});

							if (!that.clockTimeVisible) {
								startTime[0].visible = false;
								endTime[0].visible = false;
								toDoPreviousDayIndicator[0].visible = false;

							}
							if (!that.previousDayIndicator) {
								toDoPreviousDayIndicator[0].visible = false;
							}
							if (!that.draftStatus) {
								toDoDraft[0].visible = false;
							}
						} catch (e) {

						}

						that.oTableTodoPersoController.getPersoService().setPersData(data).done(function () {

						});
					}

				});
				if (!this.oTableTaskPersoController) {
					this.oTableTaskPersoController = new TablePersoController({
						table: this.oTaskTable,
						componentName: "MyTimesheet",
						persoService: oTaskPersonalizer
					}).activate();
				}
				if (!this.oTablePersoController) {
					this.oTablePersoController = new TablePersoController({
						table: this.oTable,
						componentName: "MyTimesheet",
						persoService: oPersonalizer
					}).activate();
				}
				if (sap.ui.Device.system.phone === true) {
					this.oTableTaskPersoController.getPersoService().getPersData().done(function (data) {
						if (data) {
							try {
								var columns = $.grep(data.aColumns, function (element, ind) {
									return (element.id.split('-')[element.id.split('-').length - 1] !== "AssignmentName") && (element.id.split('-')[element.id
										.split(
											'-').length - 1] !== "AssignmentStatus");
								});
								for (var i = 0; i < columns.length; i++) {
									columns[i].visible = false;
								}
							} catch (e) {

							}
							that.oTableTaskPersoController.getPersoService().setPersData(data).done(function () {

							});
						}

					});

				}
				this.oTablePersoController.getPersoService().getPersData().done(function (data) {
					if (data) {
						try {
							var startTime = $.grep(data.aColumns, function (element, ind) {
								return element.id.split('-')[element.id.split('-').length - 1] === "startTime";
							});
							var endTime = $.grep(data.aColumns, function (element, ind) {
								return element.id.split('-')[element.id.split('-').length - 1] === "endTime";
							});
							var previousDayIndicator = $.grep(data.aColumns, function (element, ind) {
								return element.id.split('-')[element.id.split('-').length - 1] === "previousDayIndicator";
							});
							var draft = $.grep(data.aColumns, function (element, ind) {
								return element.id.split('-')[element.id.split('-').length - 1] === "draft";
							});
							var entered = $.grep(data.aColumns, function (element, ind) {
								return element.id.split('-')[element.id.split('-').length - 1] === "entered";
							});
							var project = $.grep(data.aColumns, function (element, ind) {
								return element.id.split('-')[element.id.split('-').length - 1] === "project";
							});
							// if (that.clockTimeVisible) {
							// 	startTime[0].visible = true;
							// 	endTime[0].visible = true;
							// } else {
							// 	startTime[0].visible = false;
							// 	endTime[0].visible = false;
							// }
							// if (that.draftStatus) {
							// 	draft[0].visible = true;
							// } else {
							// 	draft[0].visible = false;
							// }
							// if (sap.ui.Device.system.phone === true) {
							// 	entered[0].visible = false;
							// } else {
							// 	entered[0].visible = true;
							//}

							if (!that.clockTimeVisible) {
								startTime[0].visible = false;
								endTime[0].visible = false;
								previousDayIndicator[0].visible = false;

							}
							if (!that.previousDayIndicator) {
								previousDayIndicator[0].visible = false;
							}

							if (!that.draftStatus) {
								draft[0].visible = false;
							}
						} catch (e) {

						}
						that.oTablePersoController.getPersoService().setPersData(data).done(function () {

						});
					}

				});
				// }
			}
			//Changing the property to sustain the fixed header
			// try {
			// 	this.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
			// } catch (exception) {

			// }
		},
		setFocusFixedElement: function () {
			var fixedElement = this.byId("hiddenFocusElement");
			fixedElement.focus();
		},
		onPersButtonPressed: function (oEvent) {
			this.oTablePersoController.openDialog();
		},
		onPersTodoButtonPressed: function (oEvent) {
			this.oTableTodoPersoController.openDialog();
		},
		onPersTaskButtonPressed: function (oEvent) {
			this.oTableTaskPersoController.openDialog();
		},
		getTasks: function (initLoad, startDate, endDate, withFilter) {
			this.oTaskTable.setBusy(true);
			var that = this;
			var formattedMinDate;
			var formattedMaxDate;
			if (startDate === undefined || endDate === undefined) {
				formattedMinDate = that.oFormatDateMedium.format(new Date(that.minNavDate));
				formattedMaxDate = that.oFormatDateMedium.format(new Date(that.maxNavDate));
			} else {
				formattedMinDate = that.oFormatDateMedium.format(new Date(startDate));
				formattedMaxDate = that.oFormatDateMedium.format(new Date(endDate));
			}
			// that.byId("OverviewMessageStrip").setText(that.oBundle.getText("MessageStripWithNavigationRangeSelection", [formattedMinDate,
			// 	formattedMaxDate
			// ]));
			// that.byId("ToDoListMessageStrip").setText(that.oBundle.getText("MessageStripWithNavigationRangeSelection", [formattedMinDate,
			// 	formattedMaxDate
			// ]));
			// that.byId("AssignmentGroupsMessageStrip").setText(that.oBundle.getText("MessageStripWithNavigationRangeSelection", [
			// 	formattedMinDate, formattedMaxDate
			// ]));
			// if (withFilter) {
			// 	that.byId("AssignmentsMessageStrip").setText(that.oBundle.getText("MessageStripWithFilterRange", [formattedMinDate,
			// 		formattedMaxDate
			// 	]));
			// } else {
			// 	that.byId("AssignmentsMessageStrip").setText(that.oBundle.getText("MessageStripWithNavigationRange", [formattedMinDate,
			// 		formattedMaxDate
			// 	]));
			// }

			var oModel = new sap.ui.model.json.JSONModel();
			var TaskModel = new sap.ui.model.json.JSONModel();
			var oControl;
			var obj;
			var TaskFields = [];
			var task = {};
			if (startDate === undefined && endDate === undefined) {
				if (this.dateFrom === undefined) {
					startDate = new Date();
					endDate = new Date();
				} else {
					startDate = this.dateFrom;
					endDate = this.dateTo;
				}
			}
			var assignment = {
				"AssignmentId": null,
				"AssignmentName": null
			};
			var groups = [];
			var a = new sap.ui.model.Filter({
				path: "Pernr",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.empID
			});
			var b = new sap.ui.model.Filter({
				path: "ValidityStartDate",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: startDate
			});
			var c = new sap.ui.model.Filter({
				path: "ValidityEndDate",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: endDate
			});
			var f = [];
			f.push(b);
			f.push(c);
			f.push(a);
			var mParameters = {
				filters: f,
				urlParameters: '$expand=ToGrps',
				success: function (oData, oResponse) {
					that.tasks = oData.results;
					var date, date1, date2;
					var oLength = that.tasks.length;
					if ((oLength > 0) && (that.getModel("controls").getProperty("/informationVisible") === true)) {
						oControl = that.getModel("controls");
						oControl.setProperty("/showInformationMessage", false);
						oControl.setProperty("/showInformationMessageWithRange", true);
						oControl.setProperty("/showAssignmentsMessage", false);
						oControl.setProperty("/showAssignementMessageWithRange", true);
						oControl.setProperty("/showGroupMessage", false);
						// oControl.setProperty("/showOverviewMessage", false);
						// oControl.setProperty("/showAssignmentsMessage", false);
						// oControl.setProperty("/showOverviewMessageWithRange", true);
						// oControl.setProperty("/showToDoListMessageWithRange", true);
						// oControl.setProperty("/showAssignementMessageWithRange", true);
						// oControl.setProperty("/showAssignmentGroupsMessageWithRange", true);

						// that.byId("AssignmentsMessageStrip").setVisible(true);
						// that.byId("ToDoListMessageStrip").setVisible(true);
						// that.byId("OverviewMessageStrip").setVisible(true);
						// that.byId("AssignmentGroupsMessageStrip").setVisible(true);

						that.byId("OverviewMessageStrip").setText(that.oBundle.getText("MessageStripWithNavigationRangeSelection", [formattedMinDate,
							formattedMaxDate
						]));
						that.byId("ToDoListMessageStrip").setText(that.oBundle.getText("MessageStripWithNavigationRangeSelection", [formattedMinDate,
							formattedMaxDate
						]));
						that.byId("AssignmentGroupsMessageStrip").setText(that.oBundle.getText("MessageStripWithNavigationRangeSelection", [
							formattedMinDate, formattedMaxDate
						]));
						if (withFilter) {
							that.byId("AssignmentsMessageStrip").setText(that.oBundle.getText("MessageStripWithFilterRange", [formattedMinDate,
								formattedMaxDate
							]));
						} else {
							that.byId("AssignmentsMessageStrip").setText(that.oBundle.getText("MessageStripWithNavigationRange", [formattedMinDate,
								formattedMaxDate
							]));
						}
					} else if (that.getModel("controls").getProperty("/informationVisible") === true) {

						oControl = that.getModel("controls");
						oControl.setProperty("/showInformationMessage", true);
						oControl.setProperty("/showInformationMessageWithRange", false);
						oControl.setProperty("/showAssignmentsMessage", true);
						oControl.setProperty("/showAssignementMessageWithRange", false);
						oControl.setProperty("/showGroupMessage", true);
						//oControl.setProperty("/showOverviewMessage", true);
						// oControl.setProperty("/showAssignmentsMessage", true);
						// oControl.setProperty("/showOverviewMessageWithRange", false);
						// oControl.setProperty("/showToDoListMessageWithRange", false);
						// oControl.setProperty("/showAssignementMessageWithRange", false);
						// oControl.setProperty("/showAssignmentGroupsMessageWithRange", false);
						// oControl.setProperty("/showGroupMessage", false);

					}
					for (var i = 0; i < that.tasks.length; i++) {
						try {
							date1 = new Date(that.tasks[i].ValidityStartDate);
							date2 = new Date(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
							date = date2;
						} catch (o) {
							date = new Date(that.tasks[i].ValidityStartDate);
						}
						that.tasks[i].ValidityStartDate = date;
						try {
							date1 = new Date(that.tasks[i].ValidityEndDate);
							date2 = new Date(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
							date = date2;
						} catch (o) {
							date = new Date(that.tasks[i].ValidityEndDate);
						}
						that.tasks[i].ValidityEndDate = date;
					}
					oModel.setData(that.tasks);
					if (that.tasks.length === 0 && initLoad) {
						that.noAssignmentsDialog();
					}
					oControl = that.getModel("controls");
					that.setModel(oModel, "Tasks");
					that.setGlobalModel(oModel, "Tasks");
					for (var j = 0; j < that.tasks.length; j++) {
						task["AssignmentName"] = that.tasks[j].AssignmentName;
						for (var k = 0; k < that.tasks[j].ToGrps.results.length; k++) {
							var groupObj = $.grep(groups, function (element, ind) {
								return element.groupId == that.tasks[j].ToGrps.results[k].GrpId;
							});
							if (groupObj.length > 0) {

								var AssignmentObj = $.grep(groupObj[0].Assignments, function (element, ind) {
									return element.AssignmentId == that.tasks[j].AssignmentId;
								});
								if (AssignmentObj.length == 0) {
									var assignment = {
										"AssignmentId": that.tasks[j].AssignmentId,
										"AssignmentName": that.tasks[j].AssignmentName,
										"ValidityStartDate": that.tasks[j].ValidityStartDate,
										"ValidityEndDate": that.tasks[j].ValidityEndDate,
										"Status": that.tasks[j].AssignmentStatus,
										"Rank": that.tasks[j].ToGrps.results[k].Rank

									};
									groupObj[0].Assignments.push(assignment);
									groupObj[0].count = parseInt(groupObj[0].count) + 1;
								}

							} else if (that.tasks[j].ToGrps.results[k].GrpId && that.tasks[j].ToGrps.results[k].GrpId !== undefined && that.tasks[j].ToGrps
								.results[
									k].GrpId !== "") {
								var group = {
									"groupId": that.tasks[j].ToGrps.results[k].GrpId,
									"groupName": that.tasks[j].ToGrps.results[k].GrpName,
									"count": 1,
									"Assignments": [{
										"AssignmentId": that.tasks[j].AssignmentId,
										"AssignmentName": that.tasks[j].AssignmentName,
										"ValidityStartDate": that.tasks[j].ValidityStartDate,
										"ValidityEndDate": that.tasks[j].ValidityEndDate,
										"Status": that.tasks[j].AssignmentStatus,
										"Rank": that.tasks[j].ToGrps.results[k].Rank

									}],
								};

								groups.push(group);
							}
						}

						for (var i = 0; i < that.profileFields.length; i++) {
							if (that.profileFields[i].FieldName === "APPROVER" || that.profileFields[i].FieldName === "AssignmentStatus" || that.profileFields[
									i].FieldName === "AssignmentName" || that.profileFields[i].FieldName === "ValidityStartDate" || that.profileFields[i].FieldName ===
								"ValidityEndDate") {
								if (that.profileFields[i].FieldName === "AssignmentStatus") {
									task[that.profileFields[i].FieldName] = that.tasks[j][that.profileFields[i].FieldName] === "1" ? true : false;
								} else if (that.profileFields[i].FieldName === "ValidityStartDate") {
									task[that.profileFields[i].FieldName] = that.tasks[j][that.profileFields[i].FieldName];
								} else if (that.profileFields[i].FieldName === "ValidityEndDate") {
									task[that.profileFields[i].FieldName] = that.tasks[j][that.profileFields[i].FieldName];
								} else if (that.profileFields[i].FieldName === "APPROVER") {
									task["APPROVER"] = that.tasks[j].ApproverId;
								} else {
									task[that.profileFields[i].FieldName] = that.tasks[j][that.profileFields[i].FieldName];
								}
							} else {
								task[that.profileFields[i].FieldName] = that.tasks[j].AssignmentFields[that.profileFields[i].FieldName];
								//Display text only if it enabled via BAdI hcmfab_b_tsh_textfields in the backend
								// if (that.profileFields[i].DispValueText === "TRUE") {
								// 	that.getFieldTexts(that.profileFields[i].FieldName);
								// }
							}

						}
						var finaltask = $.extend(true, {}, task);
						TaskFields.push(finaltask);
					}
					obj = $.grep(TaskFields, function (element, ind) {
						return element.AssignmentStatus === true;
					});
					oControl.setProperty('/tasksActiveLength', obj.length);
					obj = $.grep(TaskFields, function (element, ind) {
						return element.AssignmentStatus === false;
					});
					oControl.setProperty('/tasksInactiveLength', obj.length);
					oControl.setProperty('/taskEdit', false);
					oControl.setProperty('/taskDelete', false);
					oControl.setProperty('/taskCopy', false);
					TaskModel.setData(TaskFields);
					that.setModel(TaskModel, "TaskFields");
					that.setModel(new JSONModel(groups), "AssignmentGroups");
					that.setGlobalModel(new JSONModel(groups), "AssignmentGroups");
					var oTasksWithGroups = $.extend(true, [], groups);
					oLength = oTasksWithGroups.length;
					if ((oLength > 0) && (that.getModel("controls").getProperty("/informationVisible") === true)) {
						oControl = that.getModel("controls");
						oControl.setProperty("/showGroupMessage", false);
						that.byId("AssignmentGroupsMessageStrip").setVisible(true);
					}
					for (var i = 0; i < oTasksWithGroups.length; i++) {
						oTasksWithGroups[i].AssignmentName = oTasksWithGroups[i].groupName;
						oTasksWithGroups[i].AssignmentId = oTasksWithGroups[i].groupId;
						oTasksWithGroups[i].AssignmentType = that.oBundle.getText("group");
						oTasksWithGroups[i].Type = "group";
						oTasksWithGroups[i].AssignmentStatus = "1";
					}
					var oTasks = $.extend(true, [], that.tasks);
					for (var i = 0; i < oTasks.length; i++) {
						oTasks[i].AssignmentType = "";
					}
					var sizeCareModel = new JSONModel();
					if ((oTasks.length + oTasksWithGroups.length) > 100) {
						sizeCareModel.setSizeLimit(500);
					}
					sizeCareModel.setData(oTasksWithGroups.concat(oTasks));
					that.setModel(sizeCareModel, "TasksWithGroups");
					var oSortingData = that.getModel("TasksWithGroups").getData().sort(function (element1, element2) {
						//If Assignment group and Assignment 
						if (element1.groupId && !element2.groupId) {
							return -1;
						}
						//If Assignment and assignment group
						if (!element1.groupId && element2.groupId) {
							return 1;
						}
						//If both group
						if (element1.groupId && element2.groupId) {
							if (element1.groupName.toLowerCase() <= element2.groupName.toLowerCase()) {
								return -1;
							}
							return 1;
						}
						//If both assignment
						if (element1.AssignmentName.toLowerCase() >= element2.AssignmentName.toLowerCase()) {
							return 1;
						}
						return -1;
					});
					//Additional Handling for form entry scenarios 
					if (that.getModel('controls').getProperty('/isFormEntryEnabled') === true) {
						var adHocData = {
							AssignmentId: "111",
							AssignmentName: that.formEntryName,
							AssignmentStatus: "1",
							AssignmentType: "(" + that.getModel("i18n").getResourceBundle().getText('form') + ")"
						};

						oSortingData.splice(0, 0, adHocData);
					}

					that.getModel("TasksWithGroups").setData(oSortingData);
					if (initLoad) {
						that.initPersonalization();
					}
					that.oTaskTable.setBusy(false);
					that.renderTexts();
				},
				error: function (oError) {
					that.oTaskTable.setBusy(false);
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.read(that.appendLocaleParameter('/AssignmentCollection'), mParameters);
		},
		getToDoList: function () {
			var that = this;
			this.oToDoTable.setBusy(true);
			var oModel = new sap.ui.model.json.JSONModel();
			var a = new sap.ui.model.Filter({
				path: "Pernr",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.empID
			});
			var f = [];
			f.push(a);
			if (that.profileId) {
				var b = new sap.ui.model.Filter({
					path: "ProfileId",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.profileId
				});
				if (that.profileId !== undefined) {
					f.push(b);
				}
			}
			var mParameters = {
				filters: f,
				urlParameters: '$expand=TimeEntries',
				success: function (oData, oResponse) {
					that.todolist = [];
					var recordTemplate = that.recordTemplate();
					for (var i = 0; i < oData.results.length; i++) {
						oData.results[i].CaleDate = new Date(oData.results[i].CaleDate.substring(0, 4) + "-" + oData.results[i].CaleDate.substring(4,
								6) + "-" +
							oData.results[i].CaleDate.substring(6, 8));
						oData.results[i].CaleDate = new Date(oData.results[i].CaleDate.getUTCFullYear(), oData.results[i].CaleDate.getUTCMonth(),
							oData.results[i].CaleDate.getUTCDate());
						oData.results[i].Status = that.oBundle.getText("timeMissing");
						var recordTemplate = that.recordTemplate();
						recordTemplate.AssignmentId = oData.results[i].AssignmentId;
						recordTemplate.AssignmentName = oData.results[i].AssignmentName;
						recordTemplate.Pernr = that.empID;
						recordTemplate.target = parseFloat(oData.results[i].TargetHours).toFixed(2);
						recordTemplate.missing = parseFloat(oData.results[i].MissingHours).toFixed(2);
						recordTemplate.currentMissing = recordTemplate.missing;
						recordTemplate.total = parseFloat(recordTemplate.target - recordTemplate.missing).toFixed(2);
						recordTemplate.sendButton = false;
						recordTemplate.addButton = true;
						recordTemplate.addButtonEnable = false;
						recordTemplate.deleteButtonEnable = false;
						recordTemplate.TimeEntryDataFields.WORKDATE = oData.results[i].CaleDate;
						if (oData.results[i].TimeEntries.results) {
							for (var j = 0; j < oData.results[i].TimeEntries.results.length; j++) {
								oData.results[i].TimeEntries.results[j].TimeEntryDataFields.WORKDATE = new Date(oData.results[i].TimeEntries.results[j]
									.TimeEntryDataFields.WORKDATE.getUTCFullYear(), oData.results[i].TimeEntries.results[j].TimeEntryDataFields.WORKDATE.getUTCMonth(),
									oData.results[i].TimeEntries.results[j].TimeEntryDataFields.WORKDATE.getUTCDate());
								var rejectedRecord = oData.results[i].TimeEntries.results[j];
								if (oData.results[i].TimeEntries.results[j].TimeEntryDataFields.STATUS !== '10' && oData.results[i].TimeEntries.results[j]
									.TimeEntryDataFields
									.STATUS !== '40') {
									rejectedRecord.missing = parseFloat(rejectedRecord.TimeEntryDataFields.CATSHOURS).toFixed(2);
								} else {
									rejectedRecord.missing = parseFloat(oData.results[i].TargetHours).toFixed(2);
								}
								if (oData.results[i].TimeEntries.results[j].TimeEntryDataFields.STATUS === '10') {
									rejectedRecord.SetDraft = true;
								} else {
									rejectedRecord.SetDraft = false;
								}
								rejectedRecord.target = parseFloat(oData.results[i].TargetHours).toFixed(2);
								//rejectedRecord.total = parseFloat(rejectedRecord.target - rejectedRecord.missing).toFixed(2);
								//rejectedRecord.currentMissing = rejectedRecord.missing;
								rejectedRecord.AssignmentId = oData.results[i].TimeEntries.results[j].AssignmentId; //Note
								rejectedRecord.AssignmentName = oData.results[i].TimeEntries.results[j].AssignmentName; //Note
								rejectedRecord.total = recordTemplate.total; //Note
								rejectedRecord.currentMissing = recordTemplate.missing; //Note
								rejectedRecord.sendButton = false;
								rejectedRecord.addButton = true;
								rejectedRecord.addButtonEnable = false;
								rejectedRecord.deleteButtonEnable = false;
								rejectedRecord.TimeEntryDataFields.CATSHOURS = parseFloat(rejectedRecord.TimeEntryDataFields.CATSHOURS).toFixed(2);
								that.todolist.push(rejectedRecord);
							}
						}
						if (oData.results[i].TimeEntries.results.length === 0) {
							that.todolist.push(recordTemplate);
						}

					}
					oModel.setData($.extend(true, [], that.todolist));
					oModel.attachPropertyChange(that.onToDoDataChanged.bind(that));
					that.setModel(oModel, "TodoList");
					that.setModel(new JSONModel($.extend(true, [], that.todolist)), "OriginalTodo");
					that.oToDoTable.setBusy(false);
				},
				error: function (oError) {
					that.oToDoTable.setBusy(false);
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.read(that.appendLocaleParameter('/ActionItemCollection'), mParameters);
		},
		onToDoDataChanged: function () {
			var that = this;
			var oControls = this.getModel("controls");
			oControls.setProperty('todoDataChanged', true);
		},
		getProfileFields: function (empId) {
			var that = this;
			var oModel = new sap.ui.model.json.JSONModel();
			var a = new sap.ui.model.Filter({
				path: "Pernr",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.empID
			});

			var f = [];
			f.push(a);
			if (that.profileId) {
				var b = new sap.ui.model.Filter({
					path: "ProfileId",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.profileId
				});
				if (that.profileId !== undefined) {
					f.push(b);
				}
			}

			var mParameters = {
				filters: f,
				urlParameters: '$expand=ProfileFields',
				success: function (oData, oResponse) {
					if (oData.results[0].AllowMultipleProfile !== undefined) {
						if (oData.results[0].AllowMultipleProfile === "X") {
							that.byId("switchProfileButton").setVisible(true);
						}
					}
					if (oData.results[0].PeriodType !== undefined) {
						if (oData.results[0].PeriodType == 1) {
							//Setting Daily View Flag for future reference
							that.dailyView = "X";
							that.getModel("controls").setProperty("/isDailyView", true);
						} else {
							that.dailyView = "";
							that.getModel("controls").setProperty("/isDailyView", false);
						}
					}
					//controller to check weather to have assignment with clock time or not
					if (oData.results[0].AssignmentClockTime === "X") {
						that.getModel("controls").setProperty("/assignmentClockTime", true);
					}
					if (oData.results[0].TotalTarget !== undefined) {
						if (oData.results[0].TotalTarget === "FALSE") {
							that.getModel("controls").setProperty("/totalTarget", false);
						} else {
							that.getModel("controls").setProperty("/totalTarget", true);

						}

					}
					//Initializing adhoc controls
					that.resetAdHocControls();
					//Initializing adhoc todo controls
					that.resetTodoAdHocControls();
					// Remove personnel assignment fields as they are displayed on the top exclusively already
					for (var l = 0; l < oData.results[0].ProfileFields["results"].length; l++) {
						if (oData.results[0].ProfileFields["results"][l].FieldName == "PERASCE" || oData.results[0].ProfileFields["results"][l].FieldName ==
							"PRTXTCE") {
							oData.results[0].ProfileFields["results"].splice(l, 1);
							l--;
						}
					}
					that.profileInfo = $.extend(true, [], oData.results[0]);
					var oControl = that.getModel("controls");
					oControl.setProperty('/submitDraft', oData.results[0].AllowRelease === "TRUE" ? false : true);
					oControl.setProperty('/clockTimeVisible', oData.results[0].AllowClockEntry === "TRUE" ? true : false);
					var previousDayIndicatorField = $.grep(oData.results[0].ProfileFields.results, function (n, i) {
						return (n.FieldName === "VTKEN");
					});
					if (Boolean(previousDayIndicatorField.length > 0)) {
						if (previousDayIndicatorField[0].IsReadOnly !== "TRUE") {
							that.previousDayIndicatorEdit = true;
						} else {
							that.previousDayIndicatorEdit = false;
						}
					}
					if (Boolean(previousDayIndicatorField.length > 0) && oData.results[0].AllowClockEntry === "TRUE") {
						oControl.setProperty('/previousDayIndicator', true);
						that.previousDayIndicator = true;
					} else {
						oControl.setProperty('/previousDayIndicator', false);
						that.previousDayIndicator = false;
					}
					that.draftStatus = oData.results[0].AllowRelease === "TRUE" ? false : true;
					oControl.setProperty('/isDraftEnabled', oData.results[0].AllowRelease === "TRUE" ? false : true);
					that.clockTimeVisible = oData.results[0].AllowClockEntry === "TRUE" ? true : false;
					that.hoursDisabled = oData.results[0].HoursDisabled === "TRUE" ? true : false;
					if (that.hoursDisabled) {
						oControl.setProperty('/hoursDisabled', true);
					} else {
						oControl.setProperty('/hoursDisabled', false);
					}
					//If cac1 start time and end time disabled
					if (that.clockTimeVisible === false) {
						oControl.getData().assignmentClockTime = ""; //Do not use assignment with start time and end time
						that.getModel("controls").setProperty("/assignmentClockTime", false); //Also disable the control property with clock time
					}

					that.profileFields = $.extend(true, [], oData.results[0].ProfileFields.results);
					if (!oControl.getData().assignmentClockTime) {
						var profileFields = $.extend(true, [], ($.grep(oData.results[0].ProfileFields.results, function (n, i) {
							return (n.FieldName !== "VTKEN");
						})));
					} else {
						var profileFields = $.extend(true, [], oData.results[0].ProfileFields.results);
					}
					that.displayAsAttribute = [];
					for (var i = 0; i < that.profileFields.length; i++) {
						if (that.profileFields[i].DispValueText === "TRUE") {
							that.getFieldTexts(that.profileFields[i].FieldName);
							if (that.completeTextFields[that.profileFields[i].FieldName]) //If data is already fetched so no need of fetching again for attributes
							{
								that.displayAsAttribute.push({
									field: that.profileFields[i].FieldName,
									rank: that.completeTextFields[that.profileFields[i].FieldName]
								});
								continue;
							}
						}
						if (that.completeTextFields[that.profileFields[i].FieldName]) {
							that.getFieldTexts(that.profileFields[i].FieldName);
							that.displayAsAttribute.push({
								field: that.profileFields[i].FieldName,
								rank: that.completeTextFields[that.profileFields[i].FieldName]
							});

						}
					}
					//Setting a state for attributes to call the formatter if in case it is not called
					that.setModel(new JSONModel({
						state: 1
					}), "OverviewAttributes");

					that.setModel(new JSONModel({
						state: 1
					}), "ToDoAttributes");
					//Sorting display attributes by rank
					that.displayAsAttribute = that.displayAsAttribute.sort(function (val1, val2) {
						if (val1.rank > val2.rank) {
							return 1;
						}
						return -1;
					});

					oControl.setProperty('/importWorklist', oData.results[0].DisplayWorklist === "TRUE" ? true : false);
					oControl.setProperty('/approverAllowed', oData.results[0].ApproverEntryAllowed === "TRUE" ? true : false);
					that.readOnlyTemplate();
					//Adding data to adhoc fields
					if (that.getModel('controls').getProperty('/isFormEntryEnabled')) {
						var adHocFields = $.extend(true, [], profileFields);
						var adHocLongTextField = {
							"DefaultValue": "0",
							"FieldLabel": that.oBundle.getText("comments"),
							"FieldName": "LONGTEXT_DATA",
							"FieldLength": "00001000",
							"FieldType": "Q",
							"HasF4": "",
							"frontEndField": true,
							"Description": "",
							"IsReadOnly": "FALSE",
							"Pernr": that.empID,
							"ProfileId": "",
							"single": true,
							"GroupPosition": -1,
							"FieldPosition": 5,
							"GroupName": that.oBundle.getText("formGroupName"),
							"AdditionHelp": that.oBundle.getText("formLongText") + " " + that.oBundle.getText("comments"),
							"InlineHelp": ""
						};
						adHocFields.splice(0, 0, adHocLongTextField);

						//Inserting CATSHOURS
						var adHocCatsHours = {
							"DefaultValue": "0",
							"FieldLabel": that.oBundle.getText("enteredColumn"),
							"FieldName": "CATSHOURS",
							"FieldLength": "000010",
							"FieldType": "Z", //Z will be for step input control
							"HasF4": "",
							"frontEndField": true,
							"Description": "",
							"IsReadOnly": "FALSE",
							"Pernr": that.empID,
							"ProfileId": "",
							"single": true,
							"GroupPosition": -1,
							"FieldPosition": 2,
							"GroupName": that.oBundle.getText("formGroupName"),
							"AdditionHelp": that.oBundle.getText("formLongText") + " " + that.oBundle.getText("enteredColumn"),
							"InlineHelp": ""
						};
						adHocFields.splice(0, 0, adHocCatsHours);

						//Checking for clock Times
						if (oControl.getProperty("/clockTimeVisible")) {
							//If Clock time is visible
							var adHocStartTime = {
								"DefaultValue": "00000000",
								"FieldLabel": that.oBundle.getText("startTime"),
								"FieldName": "BEGUZ",
								"frontEndField": true,
								"FieldLength": "000010",
								"FieldType": "B", //B will be for clock times
								"HasF4": "",
								"IsReadOnly": "FALSE",
								"Pernr": that.empID,
								"ProfileId": "",
								"single": true,
								"GroupPosition": -1,
								"FieldPosition": 0,
								"GroupName": that.oBundle.getText("formGroupName"),
								"AdditionHelp": that.oBundle.getText("formLongText") + " " + that.oBundle.getText("startTime"),
								"InlineHelp": ""
							};

							var adHocEndTime = {
								"DefaultValue": "00000000",
								"FieldLabel": that.oBundle.getText("endTime"),
								"FieldName": "ENDUZ",
								"frontEndField": true,
								"FieldLength": "000010",
								"FieldType": "B", //B is for clock times
								"HasF4": "",
								"IsReadOnly": "FALSE",
								"Pernr": that.empID,
								"ProfileId": "",
								"single": true,
								"GroupPosition": -1,
								"FieldPosition": 1,
								"GroupName": that.oBundle.getText("formGroupName"),
								"AdditionHelp": that.oBundle.getText("formLongText") + " " + that.oBundle.getText("endTime"),
								"InlineHelp": ""
							};
							adHocFields.splice(0, 0, adHocStartTime);
							adHocFields.splice(0, 0, adHocEndTime);

						}
						//Previous day indicator
						if (oControl.getProperty("/previousDayIndicator")) {
							//If  already contains the previous day indicator from CAC2
							for (var adHocIndex = 0; adHocIndex < adHocFields.length; adHocIndex++) {
								if (adHocFields[adHocIndex].FieldName === "VTKEN") {
									adHocFields.splice(adHocIndex, 1);
									break;
								}
							}
							var adHocPreviousDay = {
								"DefaultValue": 0,
								"FieldLabel": that.oBundle.getText("previousDayIndicator"),
								"FieldName": "VTKEN",
								"FieldLength": "000001",
								"frontEndField": true,
								"FieldValue": false,
								"FieldType": "H", //H is reserved CheckBox
								"HasF4": "",
								"IsReadOnly": "FALSE",
								"Pernr": that.empID,
								"ProfileId": "",
								"single": true,
								"GroupPosition": -1,
								"GroupName": that.oBundle.getText("formGroupName"),
								"AdditionHelp": that.oBundle.getText("formSelectText") + " " + that.oBundle.getText("previousDayIndicator"),
								"FieldPosition": 3,
								"InlineHelp": ""
							};
							adHocFields.splice(0, 0, adHocPreviousDay);
						}

						//Draft
						if (oControl.getProperty('/submitDraft')) {
							var adHocDraft = {
								"DefaultValue": 0,
								"FieldLabel": that.oBundle.getText("InProcess"),
								"FieldName": "DRAFT",
								"FieldValue": false,
								"FieldLength": "000001",
								"FieldType": "V", //V is reserved CheckBox
								"HasF4": "",
								"IsReadOnly": "FALSE",
								"Pernr": that.empID,
								"frontEndField": true,
								"ProfileId": "",
								"single": true,
								"GroupPosition": -1,
								"GroupName": that.oBundle.getText("formGroupName"),
								"AdditionHelp": that.oBundle.getText("formSelectText") + " " + that.oBundle.getText("InProcess"),
								"FieldPosition": 10,
								"InlineHelp": ""
							};

							adHocFields.splice(0, 0, adHocDraft);
						}
						adHocFields = adHocFields.sort(function (element1, element2) {
							if (element1.GroupPosition === "" && element2.GroupPosition === "") {
								if (element1.FieldPosition === "" && element2.FieldPosition === "") {
									return 0;
								} else if (element1.FieldPosition === "" && element2.FieldPosition !== "") {
									return 1;
								} else if (element1.FieldPosition !== "" && element2.FieldPosition === "") {
									return -1;
								} else {
									return parseInt(element1.FieldPosition) <= parseInt(element2.FieldPosition) ? -1 : 1;
								}

							} else if (element1.GroupPosition === "" && element2.GroupPosition !== "") {
								return 1;
							} else if (element1.GroupPosition !== "" && element2.GroupPosition === "") {
								return -1;
							} else {
								if (parseInt(element1.GroupPosition) === parseInt(element2.GroupPosition)) {
									if (element1.FieldPosition === "" && element2.FieldPosition === "") {
										return 0;
									} else if (element1.FieldPosition === "" && element2.FieldPosition !== "") {
										return 1;
									} else if (element1.FieldPosition !== "" && element2.FieldPosition === "") {
										return -1;
									} else {
										return parseInt(element1.FieldPosition) <= parseInt(element2.FieldPosition) ? -1 : 1;
									}

								} else {

									return parseInt(element1.GroupPosition) <= parseInt(element2.GroupPosition) ? -1 : 1;
								}

							}
						});
						that.setGlobalModel(new JSONModel(adHocFields), "AdHocModel");
						that.loadAdHocEntries();
					}

					//profile fields for start time and end time added
					if (oControl.getData().assignmentClockTime) {
						var AssignmentBEGUZ = {
							"Decimals": "000000",
							"DefaultValue": "000000",
							"DispValueText": "FALSE",
							"FieldLabel": that.oBundle.getText("startTime"),
							"FieldLength": "000024",
							"FieldName": "BEGUZ",
							"FieldType": "T",
							"HasF4": "X",
							"IsReadOnly": "FALSE",
							"Pernr": "00000000",
							"ProfileId": "",
							"Required": "",
							"SelWorkList": "",
							"GroupName": that.oBundle.getText("timeEnable"),
							"GroupPosition": "-1",
							"FieldPosition": 0,
							"AdditionHelp": that.oBundle.getText("enterStartTime")
						};
						profileFields.push(AssignmentBEGUZ);
						var AssignmentENDUZ = {
							"Decimals": "000000",
							"DefaultValue": "000000",
							"DispValueText": "FALSE",
							"FieldLabel": that.oBundle.getText("endTime"),
							"FieldLength": "000024",
							"FieldName": "ENDUZ",
							"FieldType": "T",
							"HasF4": "",
							"IsReadOnly": "FALSE",
							"Pernr": "00000000",
							"ProfileId": "",
							"Required": "",
							"SelWorkList": "",
							"GroupName": that.oBundle.getText("timeEnable"),
							"GroupPosition": "-1",
							"FieldPosition": 1,
							"AdditionHelp": that.oBundle.getText("enterEndTime"),
						};
						profileFields.push(AssignmentENDUZ);
					}

					//Looping at the profileFields
					profileFields = profileFields.sort(function (element1, element2) {
						//Checking some extreme cases
						//Both are not defined by customer
						if (element1.GroupPosition === "" && element2.GroupPosition === "") {
							if (element1.FieldPosition === "" && element2.FieldPosition === "") {
								return 0;
							} else if (element1.FieldPosition === "" && element2.FieldPosition !== "") {
								return 1;
							} else if (element1.FieldPosition !== "" && element2.FieldPosition === "") {
								return -1;
							} else {
								return parseInt(element1.FieldPosition) <= parseInt(element2.FieldPosition) ? -1 : 1;
							}

						} else if (element1.GroupPosition === "" && element2.GroupPosition !== "") {
							return 1;
						} else if (element1.GroupPosition !== "" && element2.GroupPosition === "") {
							return -1;
						} else {
							if (parseInt(element1.GroupPosition) === parseInt(element2.GroupPosition)) {
								if (element1.FieldPosition === "" && element2.FieldPosition === "") {
									return 0;
								} else if (element1.FieldPosition === "" && element2.FieldPosition !== "") {
									return 1;
								} else if (element1.FieldPosition !== "" && element2.FieldPosition === "") {
									return -1;
								} else {
									return parseInt(element1.FieldPosition) <= parseInt(element2.FieldPosition) ? -1 : 1;
								}

							} else {

								return parseInt(element1.GroupPosition) <= parseInt(element2.GroupPosition) ? -1 : 1;
							}

						}

					});

					//Creating a model for the additional search help
					var arrHelp = new Array(150); //Max number of group
					var help = {
						GroupName: null,
						groupHelp: Array(0),
						initialize: function (GroupName) {
							this.GroupName = GroupName;
							this.groupHelp = new Array(0);

						}

					};
					var insideHelp = {
						label: "",
						addtionHelp: "",
						visible: true,
						initialize: function (label, AdditionHelp, visible) {
							this.label = label + " : ";
							this.AdditionHelp = AdditionHelp;
							this.visible = visible;
						}
					};
					//Declaring the structure of our data
					for (var it = 0; it < profileFields.length; it++) {
						//Sorted order
						if (profileFields[it].GroupPosition !== "") {
							if (arrHelp[parseInt(profileFields[it].GroupPosition)]) {

								var oInsideHelp = Object.create(insideHelp);
								if (profileFields[it].AdditionHelp === "") {
									oInsideHelp.initialize(profileFields[it].FieldLabel, profileFields[it].AdditionHelp, false);
								} else {
									oInsideHelp.initialize(profileFields[it].FieldLabel, profileFields[it].AdditionHelp, true);
								}
								arrHelp[parseInt(profileFields[it].GroupPosition)].groupHelp.push(oInsideHelp);

							} else {
								var oArrHelp = Object.create(help);
								oArrHelp.initialize(profileFields[it].GroupName);
								var oInsideHelp = Object.create(insideHelp);
								if (profileFields[it].AdditionHelp === "") {
									oInsideHelp.initialize(profileFields[it].FieldLabel, profileFields[it].AdditionHelp, false);
								} else {
									oInsideHelp.initialize(profileFields[it].FieldLabel, profileFields[it].AdditionHelp, true);
								}
								arrHelp[parseInt(profileFields[it].GroupPosition)] = oArrHelp;
								arrHelp[parseInt(profileFields[it].GroupPosition)].groupHelp.push(oInsideHelp);
							}

						} else {

							if (arrHelp[arrHelp.length - 1]) {

								var oInsideHelp = Object.create(insideHelp);
								if (profileFields[it].AdditionHelp === "") {
									oInsideHelp.initialize(profileFields[it].FieldLabel, profileFields[it].AdditionHelp, false);
								} else {
									oInsideHelp.initialize(profileFields[it].FieldLabel, profileFields[it].AdditionHelp, true);
								}
								arrHelp[arrHelp.length - 1].groupHelp.push(oInsideHelp);

							} else {
								var oArrHelp = Object.create(help);
								oArrHelp.initialize(profileFields[it].GroupName);
								var oInsideHelp = Object.create(insideHelp);
								if (profileFields[it].AdditionHelp === "") {
									oInsideHelp.initialize(profileFields[it].FieldLabel, profileFields[it].AdditionHelp, false);
								} else {
									oInsideHelp.initialize(profileFields[it].FieldLabel, profileFields[it].AdditionHelp, true);
								}
								arrHelp[arrHelp.length - 1] = oArrHelp;
								arrHelp[arrHelp.length - 1].groupHelp.push(oInsideHelp);
							}

						}

					}

					that.setGlobalModel(new JSONModel(arrHelp), "AdditionalHelp");
					that.setGlobalModel(new JSONModel(arrHelp), "AdditionHelp");
					if (that.getModel('controls').getProperty('/isFormEntryEnabled')) {
						//Handling additional Case for adHoc Additional Help
						var arrHelp = new Array(150); //Max number of group
						var help = {
							GroupName: null,
							groupHelp: Array(0),
							initialize: function (GroupName) {
								this.GroupName = GroupName;
								this.groupHelp = new Array(0);

							}

						};
						insideHelp = {
							label: "",
							addtionHelp: "",
							visible: true,
							initialize: function (label, AdditionHelp, visible) {
								this.label = label + " : ";
								this.AdditionHelp = AdditionHelp;
								this.visible = visible;
							}
						};
						//Declaring the structure of our data
						for (var it = 0; it < adHocFields.length; it++) {
							//Sorted order
							if (adHocFields[it].GroupPosition !== "") {
								if (arrHelp[parseInt(adHocFields[it].GroupPosition)]) {

									var oInsideHelp = Object.create(insideHelp);
									if (adHocFields[it].AdditionHelp === "") {
										oInsideHelp.initialize(adHocFields[it].FieldLabel, adHocFields[it].AdditionHelp, false);
									} else {
										oInsideHelp.initialize(adHocFields[it].FieldLabel, adHocFields[it].AdditionHelp, true);
									}
									arrHelp[parseInt(adHocFields[it].GroupPosition)].groupHelp.push(oInsideHelp);

								} else {
									var oArrHelp = Object.create(help);
									oArrHelp.initialize(adHocFields[it].GroupName);
									var oInsideHelp = Object.create(insideHelp);
									if (adHocFields[it].AdditionHelp === "") {
										oInsideHelp.initialize(adHocFields[it].FieldLabel, adHocFields[it].AdditionHelp, false);
									} else {
										oInsideHelp.initialize(adHocFields[it].FieldLabel, adHocFields[it].AdditionHelp, true);
									}
									arrHelp[parseInt(adHocFields[it].GroupPosition)] = oArrHelp;
									arrHelp[parseInt(adHocFields[it].GroupPosition)].groupHelp.push(oInsideHelp);
								}

							} else {

								if (arrHelp[arrHelp.length - 1]) {

									var oInsideHelp = Object.create(insideHelp);
									if (adHocFields[it].AdditionHelp === "") {
										oInsideHelp.initialize(adHocFields[it].FieldLabel, adHocFields[it].AdditionHelp, false);
									} else {
										oInsideHelp.initialize(adHocFields[it].FieldLabel, adHocFields[it].AdditionHelp, true);
									}
									arrHelp[arrHelp.length - 1].groupHelp.push(oInsideHelp);

								} else {
									var oArrHelp = Object.create(help);
									oArrHelp.initialize(adHocFields[it].GroupName);
									var oInsideHelp = Object.create(insideHelp);
									if (adHocFields[it].AdditionHelp === "") {
										oInsideHelp.initialize(adHocFields[it].FieldLabel, adHocFields[it].AdditionHelp, false);
									} else {
										oInsideHelp.initialize(adHocFields[it].FieldLabel, adHocFields[it].AdditionHelp, true);
									}
									arrHelp[arrHelp.length - 1] = oArrHelp;
									arrHelp[arrHelp.length - 1].groupHelp.push(oInsideHelp);
								}

							}

						}

						that.setGlobalModel(new JSONModel(arrHelp), "adHocAdditionalHelp");
						that.setGlobalModel(new JSONModel(arrHelp), "adHocAdditionHelp");
					}

					var AssignmentNameField = {
						"DefaultValue": "",
						"FieldLabel": that.oBundle.getText("name"),
						"FieldName": "AssignmentName",
						"FieldLength": "00064",
						"HasF4": "X",
						"IsReadOnly": "FALSE",
						"FieldType": "C",
						"Pernr": that.empID,
						"ProfileId": ""
					};
					profileFields.unshift(AssignmentNameField);
					if (oControl.getProperty('/approverAllowed')) {
						var AssignmentNameField = {
							"DefaultValue": "",
							"FieldLabel": that.oBundle.getText("approver"),
							"FieldName": "APPROVER",
							"FieldLength": "00008",
							"FieldType": "C",
							"HasF4": "",
							"IsReadOnly": "FALSE",
							"Pernr": that.empID,
							"ProfileId": ""
						};
						profileFields.push(AssignmentNameField);
					}
					var AssignmentNameField = {
						"DefaultValue": "",
						"FieldLabel": that.oBundle.getText("status"),
						"FieldName": "AssignmentStatus",
						"FieldLength": "00000",
						"HasF4": "",
						"IsReadOnly": "FALSE",
						"Pernr": that.empID,
						"ProfileId": "HR-ONLY",
						"Switch": "true"
					};
					profileFields.push(AssignmentNameField);
					var ValidFromField = {
						"DefaultValue": "",
						"FieldLabel": that.oBundle.getText("validFrom"),
						"FieldName": "ValidityStartDate",
						"HasF4": "X",
						"IsReadOnly": "FALSE",
						"Pernr": that.empID,
					};
					profileFields.push(ValidFromField);
					var ValidToField = {
						"DefaultValue": "",
						"FieldLabel": that.oBundle.getText("validTo"),
						"FieldName": "ValidityEndDate",
						"HasF4": "X",
						"IsReadOnly": "FALSE",
						"Pernr": that.empID,
					};
					profileFields.push(ValidToField);
					var oInitModel = new JSONModel({});
					that.setModel(oInitModel, "ProfileFields");
					that.setGlobalModel(oInitModel, "ProfileFields");
					oModel.setData(profileFields);
					that.profileFields = profileFields;
					that.setModel(oModel, "ProfileFields");
					that.setGlobalModel(oModel, "ProfileFields");
					// var oColumn = new sap.ui.table.Column();
					//               that.oTaskTable.bindAggregartion("columns","/",oColumn);
				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.read(that.appendLocaleParameter('/ProfileInfoCollection'), mParameters);
		},
		openLongTextAdHocFragment: function (oEvent) {
			var that = this;
			var index1 = this.getModel('controls').getProperty('/index');
			var data = this.getModel('TimeData').getData();
			//If we have adhoc mode open from todolist a little bit of change is required 
			//No issue will be caused in using same fragement due to mutually exclusive events 
			if (this.getModel('controls').getProperty('/currentTodoAdHoc')) {
				index1 = this.getModel('controls').getProperty('/index');
				data = this.getModel('TodoList').getData();
			}

			var oDialogController = {
				handleClose: function (event) {
					var oData = that.getModel('TimeData').getData();
					var index = that.getModel('controls').getProperty('/index');
					if (this.getModel('controls').getProperty('/currentTodoAdHoc')) {
						oData = that.getModel('TodoList').getData();
					}
					oData[index] = $.extend(true, {}, that.getModel('oldModel').getData());
					//Assigning the value in case of adhoc to the field value
					that.adHocLongTextDataReference.FieldValue = oData[index].TimeEntryDataFields.LONGTEXT_DATA;
					that.getModel('AdHocModel').refresh();

					this.getModel('TimeData').refresh();
					that.dialog.close();
					that.dialog.destroy();
				}.bind(this),
				onLongTextEdit: this.onAdHocTextEdit.bind(this),
				onLongTextDelete: this.onAdHocTextDelete.bind(this),
				onPost: this.onAdHocLongTextPost.bind(this),
				formatter: this.formatter.visibility.bind(this),
				formatText: function (oText) {
					return oText;
				},

				handleOk: function (oEvent) {

					that.dialog.close();
					that.dialog.destroy();

				}.bind(this)
			};
			var data = null;
			if (this.getModel('controls').getProperty('/currentAdHoc')) {
				data = $.extend(true, [], this.getModel('TimeData').getData()[index1]);
			} else //Case of todo list adhoc
			{
				data = $.extend(true, [], this.getModel('TodoList').getData()[index1]);
			}

			var oModel = new JSONModel(data);
			this.setModel(oModel, "oldModel");
			// if (!this.dialog) {
			this.dialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.adHocLongTextPopover",
				oDialogController);
			this.getView().addDependent(this.dialog);

			//Creating a new model to set binding with the longtext by getting the data from the current timedata
			var index2 = this.getModel('controls').getProperty('/index');
			var oTimeData = this.getModel('TimeData').getData();
			//If its todo
			if (this.getModel('controls').getProperty('/currentTodoAdHoc')) {
				oTimeData = this.getModel('TodoList').getData();
			}
			//Now setting the model for long text
			var oLongTextData = {
				"LONGTEXT": oTimeData[index2].TimeEntryDataFields.LONGTEXT,
				"LONGTEXT_DATA": oTimeData[index2].TimeEntryDataFields.LONGTEXT_DATA
			};

			this.setModel(new JSONModel(oLongTextData), 'LongTextAdHocModel');

			// this.dialog.bindElement('Edit>EditText');

			var index = this.getModel('controls').getProperty('/index');
			var selectModel = new JSONModel(data);
			this.setModel(selectModel, "TimeEntry");

			var oControl = this.getModel('controls');
			if (this.formatter.visibility(data.TimeEntryDataFields.LONGTEXT)) {
				// var oControl = this.getModel('controls');
				oControl.setProperty('editLongTextEnabled', false);
				oControl.setProperty('feedListVisibility', true);
			}
			this.setModel(oControl, "controls");
			var oButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function () {
				this.dialog.open(oButton);
			});
		},
		onAdHocTextEdit: function (oEvent) {

			//checking from the list of feeed input if the long text is already present
			if (oEvent.getSource().getParent().getParent().getAggregation('items')[0].getText()) {
				this.byId('feedInput').setValue(oEvent.getSource().getParent().getParent().getAggregation('items')[0].getText());
				this.byId('feedInput').setEnabled(true);

			}
		},
		onAdHocTextDelete: function (oEvent) {
			if (oEvent.getSource().getParent().getParent().getAggregation('items')[0].getText()) {
				// Deleting text (if any)
				this.byId('feedInput').setValue("");
				var index = this.getModel('controls').getProperty('/index');
				oEvent.getSource().getParent().getParent().getAggregation('items')[0].setText("");
				var okButton = oEvent.getSource().getParent().getParent().getParent().getAggregation('beginButton');
				var data = this.getModel('TimeData').getData();
				if (this.getModel('controls').getProperty('/currentTodoAdHoc')) {
					data = this.getModel('TodoList').getData();
				}
				data[index].TimeEntryDataFields.LONGTEXT_DATA = "";
				data[index].TimeEntryDataFields.LONGTEXT = '';
				var oLongTextData = {
					"LONGTEXT": data[index].TimeEntryDataFields.LONGTEXT,
					"LONGTEXT_DATA": data[index].TimeEntryDataFields.LONGTEXT_DATA
				};
				this.getModel("LongTextAdHocModel").setData(oLongTextData);
				this.adHocLongTextDataReference.FieldValue = data[index].TimeEntryDataFields.LONGTEXT_DATA;
				this.getModel('AdHocModel').refresh();
				this.getModel("LongTextAdHocModel").refresh();
				this.getModel('TimeData').refresh();
				this.getModel('TodoList').refresh();
				okButton.setEnabled(true);
			}
		},
		onAdHocLongTextPost: function (oEvent) {

			var index = this.getModel('controls').getProperty('/index');
			var okButton = oEvent.getSource().getParent().getAggregation('beginButton');
			var data = this.getModel('TimeData').getData();
			if (this.getModel('controls').getProperty('/currentTodoAdHoc')) {
				data = this.getModel('TodoList').getData();
			}
			if (oEvent.getParameter('value')) {
				data[index].TimeEntryDataFields.LONGTEXT_DATA = oEvent.getParameter('value');
				data[index].TimeEntryDataFields.LONGTEXT = 'X';
				var oLongTextData = {
					"LONGTEXT": data[index].TimeEntryDataFields.LONGTEXT,
					"LONGTEXT_DATA": data[index].TimeEntryDataFields.LONGTEXT_DATA
				};
				this.adHocLongTextDataReference.FieldValue = data[index].TimeEntryDataFields.LONGTEXT_DATA;
				this.getModel('AdHocModel').refresh();

				this.getModel("LongTextAdHocModel").setData(oLongTextData);
				this.getModel("LongTextAdHocModel").refresh();
				this.getModel('TimeData').refresh();
				this.getModel('TodoList').refresh();

				okButton.setEnabled(true);
			}

		},

		longtextPopover: function (oEvent) {
			// create popover
			var that = this;
			var index1 = oEvent.getSource().getBindingContext('TimeData').getPath().split('/')[1];

			var oDialogController = {
				handleClose: function (event) {

					var data = $.extend(true, [], this.getModel('oldModel').getData());
					var oModel = new JSONModel(data);
					this.setFocusFixedElement();
					this.setModel(oModel, 'TimeData');
					that.dialog.close();
					that.dialog.destroy();

					var item = $.grep(that.oTable.getItems(), function (element, index) {
						if (!element.getAggregation('cells')) {
							return false;
						} else {

							return true;
						}
					});
					item[index1].focus();

				}.bind(this),
				onLongTextEdit: this.onTextEdit.bind(this),
				onLongTextDelete: this.onTextDelete.bind(this),
				onPost: this.onLongTextPost.bind(this),
				formatter: this.formatter.visibility.bind(this),
				formatText: function (oText) {
					return oText;
				},

				handleOk: function (oEvent) {
					if (that.checkButtonNeeded === "X") {
						that.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
						that.getModel("controls").setProperty("/isOverviewChanged", false);
						that.getModel("controls").setProperty("/overviewDataChanged", false);
					} else {
						that.getModel("controls").setProperty("/isOverviewChanged", true);
						that.getModel("controls").setProperty("/overviewDataChanged", true);
					}
					that.successfulCheck = "";
					sap.ushell.Container.setDirtyFlag(true);
					that.dialog.close();
					that.dialog.destroy();
					var item = $.grep(that.oTable.getItems(), function (element, index) {
						if (!element.getAggregation('cells')) {
							return false;
						} else {

							return true;
						}
					});
					item[index1].focus();
				}.bind(this)
			};
			var data = $.extend(true, [], this.getModel('TimeData').getData());
			var oModel = new JSONModel(data);
			this.setModel(oModel, "oldModel");
			// if (!this.dialog) {
			this.dialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.EditLongTextPopOver",
				oDialogController);
			this.getView().addDependent(this.dialog);
			this.dialog.bindElement('TimeData>' + oEvent.getSource().getBindingContext('TimeData').getPath());
			// this.dialog.bindElement('Edit>EditText');

			var index = oEvent.getSource().getBindingContext('TimeData').getPath().split('/')[1];
			var selectModel = new JSONModel(data);
			this.setModel(selectModel, "TimeEntry");
			// var data = $.extend(true, [], this.getModel('TimeData').getData());
			// var oModel = new JSONModel(data);
			// this.setModel(oModel, "oldModel");
			var oControl = this.getModel('controls');
			if (this.formatter.visibility(data[index].TimeEntryDataFields.LONGTEXT)) {
				// var oControl = this.getModel('controls');
				oControl.setProperty('editLongTextEnabled', false);
				oControl.setProperty('feedListVisibility', true);
			}
			this.setModel(oControl, "controls");
			var oButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function () {
				this.dialog.open(oButton);
			});

			// }

			// delay because addDependent will do a async rerendering and the popover will immediately close without it

		},

		onTextEdit: function (oEvent) {
			var index = oEvent.getSource().getParent().getParent().getBindingContext('TimeData').getPath().split('/')[1];

			if (oEvent.getSource().getParent().getParent().getAggregation('items')[0].getText()) {
				this.byId('feedInput').setValue(oEvent.getSource().getParent().getParent().getAggregation('items')[0].getText());
				this.byId('feedInput').setEnabled(true);

			}
			var item = $.grep(this.oTable.getItems(), function (element, index) {
				if (!element.getAggregation('cells')) {
					return false;
				} else {
					return true;
				}
			});
			item[index].focus();
		},
		onTextEditToDo: function (oEvent) {
			var index = oEvent.getSource().getParent().getParent().getBindingContext('TodoList').getPath().split('/')[1];

			if (oEvent.getSource().getParent().getParent().getAggregation('items')[0].getText()) {
				this.byId('feedInput').setValue(oEvent.getSource().getParent().getParent().getAggregation('items')[0].getText());
				this.byId('feedInput').setEnabled(true);

			}
			var item = $.grep(this.oTable.getItems(), function (element, index) {
				if (!element.getAggregation('cells')) {
					return false;
				} else {
					return true;
				}
			});
			item[index].focus();
		},
		onTextDelete: function (oEvent) {
			if (oEvent.getSource().getParent().getParent().getAggregation('items')[0].getText()) {
				// Deleting text (if any)
				this.byId('feedInput').setValue("");
				var index = oEvent.getSource().getParent().getParent().getBindingContext('TimeData').getPath().split('/')[1];
				oEvent.getSource().getParent().getParent().getAggregation('items')[0].setText("");
				var okButton = oEvent.getSource().getParent().getParent().getParent().getAggregation('beginButton');
				var data = this.getModel('TimeData').getData();
				// data[index].TimeEntryDataFields.LTXA1 = oEvent.getParameter('value');
				data[index].TimeEntryDataFields.LONGTEXT_DATA = "";
				data[index].TimeEntryDataFields.LONGTEXT = '';
				if (data[index].Counter !== "") {
					data[index].TimeEntryOperation = 'U';
				} else {
					data[index].TimeEntryOperation = 'C';
				}
				var oModel = new JSONModel(data);
				this.setModel(oModel, "TimeData");
				okButton.setEnabled(true);
			}
			var item = $.grep(this.oTable.getItems(), function (element, index) {
				if (!element.getAggregation('cells')) {
					return false;
				} else {
					return true;
				}
			});
		},
		onTextDeleteTodo: function (oEvent) {
			if (oEvent.getSource().getParent().getParent().getAggregation('items')[0].getText()) {
				// Deleting text (if any)
				this.byId('feedInput').setValue("");
				var index = oEvent.getSource().getParent().getParent().getBindingContext('TodoList').getPath().split('/')[1];
				oEvent.getSource().getParent().getParent().getAggregation('items')[0].setText("");
				var okButton = oEvent.getSource().getParent().getParent().getParent().getAggregation('beginButton');
				var data = this.getModel('TodoList').getData();
				data[index].TimeEntryDataFields.LONGTEXT_DATA = "";
				data[index].TimeEntryDataFields.LONGTEXT = '';
				if (data[index].Counter !== "") {
					data[index].TimeEntryOperation = 'U';
				} else {
					data[index].TimeEntryOperation = 'C';
				}
				var oModel = new JSONModel(data);
				this.setModel(oModel, "TodoList");
				okButton.setEnabled(true);
			}
		},
		getGroupHeader: function (oGroup, count) {
			oGroup.key = this.oFormatDate.format(new Date(oGroup.date));
			return new GroupHeaderListItem({
				title: oGroup.key,
				upperCase: false
			});
		},

		onStatusChangeFilter: function (filterKey) {
			var selectedKey = filterKey;
			var oFilter = [];
			var oControl = this.getModel("controls");
			if (selectedKey !== '100') {
				oFilter.push(new Filter("Status", FilterOperator.Contains, selectedKey));
			}

			var oRef = this.oTable.getBinding('items').filter(oFilter);
			if (oRef.getLength() === 0) {
				oControl.setProperty('/overviewEditEnabled', false);
			} else {
				if (oControl.getProperty('/onEdit') === "None") {
					oControl.setProperty('/overviewEditEnabled', true);
				}
			}

		},
		onStatusChange: function (oEvent) {
			var selectedKey = oEvent.getParameter('selectedItem').getKey();
			var oFilter = [];
			var oControl = this.getModel("controls");
			if (selectedKey !== '100') {
				oFilter.push(new Filter("Status", FilterOperator.Contains, selectedKey));
			}

			var oRef = this.oTable.getBinding('items').filter(oFilter);
			if (oRef.getLength() === 0) {
				oControl.setProperty('/overviewEditEnabled', false);
			} else {
				if (oControl.getProperty('/onEdit') === "None") {
					oControl.setProperty('/overviewEditEnabled', true);
				}
			}
		},
		onStatusChangeAfterSort: function (filterKey) {
			var selectedKey = filterKey;
			var oFilter = [];
			var oControl = this.getModel("controls");
			if (selectedKey !== '100') {
				oFilter.push(new Filter("Status", FilterOperator.Contains, selectedKey));
			}

			var oRef = this.oTable.getBinding('items').filter(oFilter);
			if (oRef.getLength() === 0) {
				oControl.setProperty('/overviewEditEnabled', false);
			} else {
				if (oControl.getProperty('/onEdit') === "None") {
					oControl.setProperty('/overviewEditEnabled', true);
				}
			}
		},
		handleDupTaskCalendarSelect: function (oEvent) {
			var oCalendar = oEvent.getSource();
			var aSelectedDates = oCalendar.getSelectedDates();
			var oDate;
			var oData = {
				selectedDates: []
			};
			var oModel = new JSONModel();
			if (aSelectedDates.length > 0) {
				for (var i = 0; i < aSelectedDates.length; i++) {
					oDate = aSelectedDates[i].getStartDate();
					oData.selectedDates.push({
						Date: oDate
					});
				}
				oModel.setData(oData);
				this.setModel(oModel, 'selectedDatesDup').updateBindings();
			} else {
				oModel.setData([]);
				this.setModel(oModel, 'selectedDatesDup').updateBindings();
			}
			if (this.getModel("TimeDataDuplicateTask").getData().length >= 1 &&
				this.getModel("selectedDatesDup").getData().selectedDates.length >= 1) {
				this.getModel("controls").setProperty("/duplicateTaskButtonEnable", true);
			}
		},
		EditTodoLongTextPopover: function (oEvent) {
			// create popover
			var that = this;
			var index1 = oEvent.getSource().getBindingContext('TodoList').getPath().split('/')[1];
			var oDialogController = {
				handleClose: function (event) {
					that.dialog.close();
					that.dialog.destroy();
					var item = $.grep(that.oToDoTable.getItems(), function (element, index) {
						if (!element.getAggregation('cells')) {
							return false;
						} else {

							return true;
						}
					});
					item[index1].focus();

				},
				onLongTextEdit: this.onTextEditToDo.bind(this),
				onLongTextDelete: this.onTextDeleteTodo.bind(this),
				onPost: this.onTodoLongTextPost.bind(this),
				formatter: this.formatter.visibility.bind(this),
				handleOk: function (oEvent) {
					if (that.checkButtonNeeded === "X") {
						that.getModel("controls").setProperty("/todoDataChangedWithCheck", true);
						that.getModel("controls").setProperty("/isToDoChanged", false);
						that.getModel("controls").setProperty("/todoDataChanged", false);
					} else {
						that.getModel("controls").setProperty("/isToDoChanged", true);
						that.getModel("controls").setProperty("/todoDataChanged", true);
					}
					sap.ushell.Container.setDirtyFlag(true);
					that.successfulToDoCheck = "";
					that.dialog.close();
					that.dialog.destroy();
					var item = $.grep(that.oToDoTable.getItems(), function (element, index) {
						if (!element.getAggregation('cells')) {
							return false;
						} else {

							return true;
						}
					});
					item[index1].focus();
				}.bind(this)
			};
			var data = $.extend(true, [], this.getModel('TodoList').getData());
			var oModel = new JSONModel(data);
			this.setModel(oModel, "oldModel");
			// if (!this.dialog) {
			this.dialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.EditToDoLongTextPopOver",
				oDialogController);
			this.getView().addDependent(this.dialog);
			this.dialog.bindElement('TodoList>' + oEvent.getSource().getBindingContext('TodoList').getPath());
			var index = oEvent.getSource().getBindingContext('TodoList').getPath().split('/')[1];
			var selectModel = new JSONModel(data);
			this.setModel(selectModel, "TimeEntry");
			// var data = $.extend(true, [], this.getModel('TimeData').getData());
			// var oModel = new JSONModel(data);
			// this.setModel(oModel, "oldModel");
			var oControl = this.getModel('controls');
			if (this.formatter.visibility(data[index].TimeEntryDataFields.LONGTEXT)) {
				// var oControl = this.getModel('controls');
				oControl.setProperty('editLongTextEnabled', false);
				oControl.setProperty('feedListVisibility', true);
			}
			this.setModel(oControl, "controls");
			var oButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function () {
				this.dialog.open(oButton);
			});
		},
		displaylongtextPopover: function (oEvent) {
			// create popover
			var that = this;
			var oDialogController = {
				handleClose: function (event) {
					that._oPopover.close();
				},
				commentDisplay: this.formatter.commentDisplay.bind(this)
			};
			this._oPopover = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.LongTextPopOver",
				oDialogController);
			this.getView().addDependent(this._oPopover);
			this._oPopover.bindElement('TimeData>' + oEvent.getSource().getBindingContext('TimeData').getPath());

			// delay because addDependent will do a async rerendering and the popover will immediately close without it
			var oButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function () {
				this._oPopover.openBy(oButton);
			});
		},

		displayTodoLongtextPopover: function (oEvent) {
			// create popover
			var that = this;
			// if (this._oPopover) {
			// 	this._oPopover.close();
			// }
			var oDialogController = {
				handleClose: function (event) {
					that._oPopover.close();
				},
				commentDisplay: this.formatter.commentDisplay.bind(this)
					//onChange: this.onLongTextChange.bind(this)
			};
			this._oPopover = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.ToDoLongTextPopOver",
				oDialogController);
			this.getView().addDependent(this._oPopover);
			this._oPopover.bindElement('TodoList>' + oEvent.getSource().getBindingContext("TodoList").getPath());
			// delay because addDependent will do a async rerendering and the popover will immediately close without it
			var oButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function () {
				this._oPopover.openBy(oButton);
			});
		},

		dynamicBindingRows: function (index, context) {
			var that = this;
			var obj = context.getObject();
			if (this.getModel('Tasks').getData()) {

			} else {
				return;
			}
			var data = this.getModel('Tasks').getData();
			var index = context.getPath().split('/')[1];
			var row = new sap.m.ColumnListItem({
				type: "Navigation",
				press: this.onAssignmentPress.bind(this)
			});
			for (var k in obj) {
				if (k === "AssignmentStatus") {
					row.addCell(
						new sap.m.ObjectStatus({
							text: obj[k] === true ? this.oBundle.getText('activeStatus') : this.oBundle.getText('inactiveStatus'),
							state: obj[k] === true ? sap.ui.core.ValueState.Success : sap.ui.core.ValueState.Error,
							customData: [new sap.ui.core.CustomData({
									"key": "FieldName",
									"value": k
								}), new sap.ui.core.CustomData({
									"key": "AssignmentId",
									"value": data[index].AssignmentId
								}),
								new sap.ui.core.CustomData({
									"key": "FieldValue",
									"value": obj[k]
								})

							]
						})
					);
				} else if (k === "ValidityStartDate" || k === "ValidityEndDate") {
					row.addCell(new sap.m.Text({
						text: this.oFormatDateMedium.format(new Date(obj[k])),
						customData: [new sap.ui.core.CustomData({
							"key": "FieldName",
							"value": k
						}), new sap.ui.core.CustomData({
							"key": "AssignmentId",
							"value": data[index].AssignmentId
						}), new sap.ui.core.CustomData({
							"key": "AssignmentValue",
							"value": new Date(obj[k])
						})]
					}));
				} else if (k === "RPROJ") { //Note
					var oModel = this.getModel(k);
					if (oModel) {
						var text = oModel.getData();
						if (text) {
							var textFound = $.grep(text, function (element, index) {
								return element.DispField1Id === obj[k];
							});
							if (textFound.length > 0) {
								if (obj[k] !== "") {
									row.addCell(new sap.m.Text({
										text: textFound[0].DispField1Val,
										customData: [new sap.ui.core.CustomData({
											"key": "FieldName",
											"value": k
										}), new sap.ui.core.CustomData({
											"key": "AssignmentId",
											"value": data[index].AssignmentId
										})]
									}));
								} else {
									row.addCell(new sap.m.Text({
										text: data[index].AssignmentFields.POSID,
										customData: [new sap.ui.core.CustomData({
											"key": "FieldName",
											"value": k
										}), new sap.ui.core.CustomData({
											"key": "AssignmentId",
											"value": data[index].AssignmentId
										})]
									}));
								}

							} else {
								if (obj[k] !== "") {
									this.renderFieldTexts.push({
										key: k,
										value: obj[k]
									});
									row.addCell(new sap.m.Text({
										text: data[index].AssignmentFields.POSID,
										customData: [new sap.ui.core.CustomData({
											"key": "FieldName",
											"value": k
										}), new sap.ui.core.CustomData({
											"key": "AssignmentId",
											"value": data[index].AssignmentId
										})]
									}));
								} else {
									row.addCell(new sap.m.Text({
										text: data[index].AssignmentFields.POSID,
										customData: [new sap.ui.core.CustomData({
											"key": "FieldName",
											"value": k
										}), new sap.ui.core.CustomData({
											"key": "AssignmentId",
											"value": data[index].AssignmentId
										})]
									}));
								}

							}
						} else {
							row.addCell(new sap.m.Text({
								text: data[index].AssignmentFields.POSID,
								customData: [new sap.ui.core.CustomData({
									"key": "FieldName",
									"value": k
								}), new sap.ui.core.CustomData({
									"key": "AssignmentId",
									"value": data[index].AssignmentId
								})]
							}));
						}
					} else {
						row.addCell(new sap.m.Text({
							text: data[index].AssignmentFields.POSID,
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": k
							}), new sap.ui.core.CustomData({
								"key": "AssignmentId",
								"value": data[index].AssignmentId
							})]
						}));
					}
				} else if (k === "BEGUZ" || k === "ENDUZ") {
					if (obj[k]) {
						row.addCell(new sap.m.Text({
							text: that.formatter.formatTime(obj[k]),
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": k
							}), new sap.ui.core.CustomData({
								"key": "AssignmentId",
								"value": data[index].AssignmentId
							})]
						}));
					} else {
						row.addCell(new sap.m.Text({
							text: "",
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": k
							}), new sap.ui.core.CustomData({
								"key": "AssignmentId",
								"value": data[index].AssignmentId
							})]
						}));
					}
				} else if (k === "PEDD") {
					if (obj[k]) {
						row.addCell(new sap.m.Text({
							text: this.oFormatDate.format(obj[k]),
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": k
							}), new sap.ui.core.CustomData({
								"key": "AssignmentId",
								"value": data[index].AssignmentId
							})]
						}));
					} else {
						row.addCell(new sap.m.Text({
							text: "",
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": k
							}), new sap.ui.core.CustomData({
								"key": "AssignmentId",
								"value": data[index].AssignmentId
							})]
						}));
					}

				} else {
					var oModel = this.getModel(k);
					if (oModel) {
						var text = oModel.getData();
						if (text) {
							var textFound = $.grep(text, function (element, index) {
								return element.DispField1Id === obj[k];
							});
							if (textFound.length > 0) {
								row.addCell(new sap.m.Text({
									text: textFound[0].DispField1Val,
									customData: [new sap.ui.core.CustomData({
										"key": "FieldName",
										"value": k
									}), new sap.ui.core.CustomData({
										"key": "AssignmentId",
										"value": data[index].AssignmentId
									})]
								}));
							} else {
								if (obj[k] !== "") {
									this.renderFieldTexts.push({
										key: k,
										value: obj[k]
									});
									row.addCell(new sap.m.Text({
										text: obj[k],
										customData: [new sap.ui.core.CustomData({
											"key": "FieldName",
											"value": k
										}), new sap.ui.core.CustomData({
											"key": "AssignmentId",
											"value": data[index].AssignmentId
										})]
									}));
								} else {
									row.addCell(new sap.m.Text({
										text: obj[k],
										customData: [new sap.ui.core.CustomData({
											"key": "FieldName",
											"value": k
										}), new sap.ui.core.CustomData({
											"key": "AssignmentId",
											"value": data[index].AssignmentId
										})]
									}));
								}

							}
						} else {
							row.addCell(new sap.m.Text({
								text: obj[k],
								customData: [new sap.ui.core.CustomData({
									"key": "FieldName",
									"value": k
								}), new sap.ui.core.CustomData({
									"key": "AssignmentId",
									"value": data[index].AssignmentId
								})]
							}));
						}
					} else {
						row.addCell(new sap.m.Text({
							text: obj[k],
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": k
							}), new sap.ui.core.CustomData({
								"key": "AssignmentId",
								"value": data[index].AssignmentId
							})]
						}));
					}
				}
			}
			// this.renderTexts();
			return row;
		},
		dynamicBindingRowsWorklist: function (index, context) {
			//Need to handle date range
			var obj = context.getObject();
			var data = this.getModel('Worklist').getData();
			var index = context.getPath().split('/')[1];
			var row = new sap.m.ColumnListItem({
				// type: "Navigation",
				// press: this.onAssignmentWorklistPress.bind(this)
			});
			for (var k in obj) {
				if (k === "RANGE") {
					if (this.getModel("controls").getProperty("/currentAdHoc") || this.getModel("controls").getProperty("/currentTodoAdHoc")) {
						row.addCell(new sap.m.Text({

							text: "test",
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": "dummy"
							}), new sap.ui.core.CustomData({
								"key": "Index",
								"value": index
							})]
						}));
					} else {

						if (data[index].WorkListDataFields.BEGDA === null && data[index].WorkListDataFields.ENDDA === null) {
							row.addCell(new sap.m.DateRangeSelection({
								dateValue: new Date(new Date().getFullYear(), 0, 1),
								secondDateValue: new Date(new Date().getFullYear(), 11, 31),

								maxLength: 30,
								customData: [new sap.ui.core.CustomData({
									"key": "FieldName",
									"value": "RANGE"
								}), new sap.ui.core.CustomData({
									"key": "Index",
									"value": index
								})]
							}));
						} else {
							row.addCell(new sap.m.DateRangeSelection({
								enabled: false,
								dateValue: new Date(data[index].WorkListDataFields.BEGDA),
								secondDateValue: new Date(data[index].WorkListDataFields.ENDDA),
								maxLength: 30,
								customData: [new sap.ui.core.CustomData({
									"key": "FieldName",
									"value": "RANGE"
								}), new sap.ui.core.CustomData({
									"key": "Index",
									"value": index
								})]
							}));
						}
					}

				} else if (k === "NAME") {
					if (this.getModel("controls").getProperty("/currentAdHoc") || this.getModel("controls").getProperty("/currentTodoAdHoc")) {
						row.addCell(new sap.m.Text({
							text: "test",
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": "dummy"
							}), new sap.ui.core.CustomData({
								"key": "Index",
								"value": index
							})]
						}));

					} else {
						row.addCell(new sap.m.Input({
							type: sap.m.InputType.Text,
							value: obj[k],
							required: true,
							enabled: false,
							// liveChange: this.handleUserInput().bind(this),
							maxLength: 30,
							placeholder: this.getResourceBundle().getText("worklistNamePlaceholder"),
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": "NAME"
							}), new sap.ui.core.CustomData({
								"key": "Index",
								"value": index
							})]
						}));
					}
				} else if (k === "RPROJ") { //Note
					if (data[index].WorkListDataFields.POSID !== "") {
						row.addCell(new sap.m.Text({
							text: obj[k] + " (" + data[index].WorkListDataFields.POSID + ")",
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": k
							}), new sap.ui.core.CustomData({
								"key": "Index",
								"value": index
							})]
						}));
					} else {
						row.addCell(new sap.m.Text({
							text: obj[k],
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": k
							}), new sap.ui.core.CustomData({
								"key": "Index",
								"value": index
							})]
						}));
					}
				} else {
					row.addCell(new sap.m.Text({
						text: obj[k],
						customData: [new sap.ui.core.CustomData({
							"key": "FieldName",
							"value": k
						}), new sap.ui.core.CustomData({
							"key": "Index",
							"value": index
						})]
					}));
				}
			}

			return row;
		},
		dynamicBindingRowsAdminlist: function (index, context) {
			var obj = context.getObject();
			if (this.getModel('AdminTasks').getData()) {

			} else {
				return;
			}
			var data = this.getModel('AdminTasks').getData();
			var index = context.getPath().split('/')[1];
			var row = new sap.m.ColumnListItem({
				// type: "Navigation",
				// press: this.onAssignmentPress.bind(this)
			});
			for (var k in obj) {
				if (k === "AssignmentStatus") {
					row.addCell(
						new sap.m.ObjectStatus({
							text: obj[k] === true ? this.oBundle.getText('activeStatus') : this.oBundle.getText('inactiveStatus'),
							state: obj[k] === true ? sap.ui.core.ValueState.Success : sap.ui.core.ValueState.Error,
							customData: [new sap.ui.core.CustomData({
									"key": "FieldName",
									"value": k
								}), new sap.ui.core.CustomData({
									"key": "AssignmentId",
									"value": data[index].AssignmentId
								}),
								new sap.ui.core.CustomData({
									"key": "FieldValue",
									"value": obj[k]
								})

							]
						})
					);
				} else if (k === "ValidityStartDate" || k === "ValidityEndDate") {
					row.addCell(new sap.m.Text({
						text: this.oFormatYyyymmdd.format(new Date(obj[k])),
						customData: [new sap.ui.core.CustomData({
							"key": "FieldName",
							"value": k
						}), new sap.ui.core.CustomData({
							"key": "AssignmentId",
							"value": data[index].AssignmentId
						})]
					}));
				} else {
					var oModel = this.getModel(k);
					if (oModel) {
						var text = oModel.getData();
						if (text) {
							var textFound = $.grep(text, function (element, index) {
								return element.DispField1Id === obj[k];
							});
							if (textFound.length > 0) {
								row.addCell(new sap.m.Text({
									text: textFound[0].DispField1Val,
									customData: [new sap.ui.core.CustomData({
										"key": "FieldName",
										"value": k
									}), new sap.ui.core.CustomData({
										"key": "AssignmentId",
										"value": data[index].AssignmentId
									}), new sap.ui.core.CustomData({
										"key": "FieldCode",
										"value": obj[k]
									})]
								}));
							} else {
								row.addCell(new sap.m.Text({
									text: obj[k],
									customData: [new sap.ui.core.CustomData({
										"key": "FieldName",
										"value": k
									}), new sap.ui.core.CustomData({
										"key": "AssignmentId",
										"value": data[index].AssignmentId
									})]
								}));
							}
						} else {
							row.addCell(new sap.m.Text({
								text: obj[k],
								customData: [new sap.ui.core.CustomData({
									"key": "FieldName",
									"value": k
								}), new sap.ui.core.CustomData({
									"key": "AssignmentId",
									"value": data[index].AssignmentId
								})]
							}));
						}
					} else {
						row.addCell(new sap.m.Text({
							text: obj[k],
							customData: [new sap.ui.core.CustomData({
								"key": "FieldName",
								"value": k
							}), new sap.ui.core.CustomData({
								"key": "AssignmentId",
								"value": data[index].AssignmentId
							})]
						}));
					}
				}
			}

			return row;
		},
		dynamicBindingColumns: function (index, context) {
			var obj = context.getObject();
			var data = this.getModel('ProfileFields').getData();
			var index = context.getPath().split('/')[1];
			var column;
			if (sap.ui.Device.system.phone === true) {
				if (data[index].FieldName === "AssignmentStatus") {
					column = new sap.m.Column(data[index].FieldName, {
						// text: data[index].FieldName,
						demandPopin: true,
						hAlign: 'End',
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else if (data[index].FieldName === "AssignmentName") {
					column = new sap.m.Column(data[index].FieldName, {
						// text: data[index].FieldName,
						demandPopin: true,
						hAlign: 'Begin',
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else if (data[index].FieldName === "ValidityStartDate") {
					column = new sap.m.Column(data[index].FieldName, {
						// text: data[index].FieldName,
						demandPopin: true,
						hAlign: 'End',
						visible: false,
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else if (data[index].FieldName === "ValidityEndDate") {
					column = new sap.m.Column(data[index].FieldName, {
						// text: data[index].FieldName,
						demandPopin: true,
						hAlign: 'End',
						visible: false,
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else {
					column = new sap.m.Column(data[index].FieldName, {
						// text: data[index].FieldName,
						demandPopin: true,
						hAlign: 'Begin',
						visible: false,
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				}

			} else {
				if (index > 5 && data[index].FieldName !== "AssignmentName" && data[index].FieldName !== "AssignmentStatus" && data[index].FieldName !==
					"APPROVER" && data[index].FieldName !== "ValidityStartDate" && data[index].FieldName !== "ValidityEndDate") {
					column = new sap.m.Column(data[index].FieldName, {
						// text: data[index].FieldName,
						minScreenWidth: "Desktop",
						demandPopin: true,
						// popinDisplay: "Inline"
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else {
					if (data[index].FieldName == "ValidityStartDate" || data[index].FieldName == "ValidityEndDate") {
						column = new sap.m.Column(data[index].FieldName, {
							// text: data[index].FieldName,
							minScreenWidth: "Desktop",
							demandPopin: true,
							hAlign: 'End',
							// popinDisplay: "Inline"
						}).setHeader(new sap.m.Text({
							text: data[index].FieldLabel
						}));
					} else if (data[index].FieldName == "AssignmentStatus") {
						column = new sap.m.Column(data[index].FieldName, {
							hAlign: 'End',
							demandPopin: true,
						}).setHeader(new sap.m.Text({
							text: data[index].FieldLabel
						}));
					} else if (data[index].FieldName == "AssignmentName") {
						column = new sap.m.Column(data[index].FieldName, {
							hAlign: 'Begin',
							demandPopin: true,
						}).setHeader(new sap.m.Text({
							text: data[index].FieldLabel
						}));
					} else {
						column = new sap.m.Column(data[index].FieldName, {
							minScreenWidth: "Desktop",
							demandPopin: true,
						}).setHeader(new sap.m.Text({
							text: data[index].FieldLabel
						}));
					}

				}

			}

			return column;
		},
		dynamicBindingColumnsWorklist: function (index, context) {
			var obj = context.getObject();
			var data = this.getModel('WorklistProfileFields').getData();
			var index = context.getPath().split('/')[1];
			if (this.getModel('controls').getProperty('/currentAdHoc') || this.getModel("controls").getProperty("/currentTodoAdHoc")) {
				if (data[index].FieldName === "NAME" || data[index].FieldName === "RANGE") {
					return new sap.m.Column({
						visible: false
					});
				}
			}
			if (sap.ui.Device.system.phone === true) {
				var column = new sap.m.Column({
					minScreenWidth: "2800px",
					demandPopin: true
				}).setHeader(new sap.m.Text({
					text: data[index].FieldLabel
				}));
				return column;
			} else {
				if (index > 5) {
					var column = new sap.m.Column({
						minScreenWidth: "2800px",
						demandPopin: true
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else {
					var column = new sap.m.Column({
						minScreenWidth: "Tablet",
						demandPopin: true
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				}

				return column;
			}

		},
		dynamicBindingColumnsAdminlist: function (index, context) {
			var obj = context.getObject();
			var data = this.getModel('ProfileFields').getData();
			var index = context.getPath().split('/')[1];
			var column;
			if (sap.ui.Device.system.phone === true) {
				if (data[index].FieldName === "AssignmentStatus") {
					column = new sap.m.Column("Admin" + data[index].FieldName, {
						demandPopin: true,
						hAlign: 'End'
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else if (data[index].FieldName === "AssignmentName") {
					column = new sap.m.Column("Admin" + data[index].FieldName, {
						demandPopin: true,
						hAlign: 'Begin'
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else if (data[index].FieldName === "ValidityStartDate") {
					column = new sap.m.Column("Admin" + data[index].FieldName, {
						demandPopin: true,
						hAlign: 'End',
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else if (data[index].FieldName === "ValidityEndDate") {
					column = new sap.m.Column("Admin" + data[index].FieldName, {
						demandPopin: true,
						hAlign: 'End',
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else {
					column = new sap.m.Column("Admin" + data[index].FieldName, {
						minScreenWidth: sap.m.ScreenSize.Small,
						demandPopin: true,
						hAlign: 'Begin',
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				}

			} else {
				if (index > 5 && data[index].FieldName !== "AssignmentName" && data[index].FieldName !== "AssignmentStatus" && data[index].FieldName !==
					"APPROVER" && data[index].FieldName !== "ValidityStartDate" && data[index].FieldName !== "ValidityEndDate") {
					column = new sap.m.Column("Admin" + data[index].FieldName, {
						minScreenWidth: "2800px",
						demandPopin: true,
					}).setHeader(new sap.m.Text({
						text: data[index].FieldLabel
					}));
				} else {
					if (data[index].FieldName !== "ValidityStartDate" && data[index].FieldName !== "ValidityEndDate") {
						column = new sap.m.Column("Admin" + data[index].FieldName, {
							minScreenWidth: "Tablet",
							demandPopin: true,
						}).setHeader(new sap.m.Text({
							text: data[index].FieldLabel
						}));
					} else {
						column = new sap.m.Column("Admin" + data[index].FieldName, {
							minScreenWidth: "Tablet",
							demandPopin: true,
							hAlign: 'End',
						}).setHeader(new sap.m.Text({
							text: data[index].FieldLabel
						}));
					}

				}

			}

			return column;
		},
		performImportAssignments: function (selectedItems) {
			var that = this;
			that.oDataReturnCount = 0;
			this.showBusy();
			that.oDataImportAssignmentsModel = this.getOwnerComponent().getModel();
			that.oDataImportAssignmentsModel.resetChanges();
			that.oDataImportAssignmentsModel.setChangeBatchGroups({
				"*": {
					groupId: "ImportAssignments",
					changeSetId: "ImportAssignments",
					single: false
				}
			});
			that.oDataImportAssignmentsModel.setDeferredGroups(["ImportAssignments"]);
			that.oDataImportAssignmentsModel
				.refreshSecurityToken(
					function (oData) {
						if (selectedItems.length > 0) {
							for (var j = 0; j < selectedItems.length; j++) {
								var obj = {
									properties: {
										ApproverId: selectedItems[j].ApproverId,
										ApproverName: selectedItems[j].ApproverName,
										AssignmentId: selectedItems[j].AssignmentId,
										AssignmentName: selectedItems[j].AssignmentName,
										AssignmentOperation: selectedItems[j].AssignmentOperation,
										AssignmentStatus: selectedItems[j].AssignmentStatus,
										Counter: selectedItems[j].Counter,
										Pernr: selectedItems[j].Pernr,
										ProfileId: selectedItems[j].ProfileId,
										ValidityStartDate: selectedItems[j].ValidityStartDate,
										ValidityEndDate: selectedItems[j].ValidityEndDate,
										AssignmentFields: {
											AENAM: selectedItems[j].AssignmentFields.AENAM,
											ALLDF: selectedItems[j].AssignmentFields.ALLDF,
											APDAT: selectedItems[j].AssignmentFields.APDAT,
											APNAM: selectedItems[j].AssignmentFields.APNAM,
											ARBID: selectedItems[j].AssignmentFields.ARBID,
											ARBPL: selectedItems[j].AssignmentFields.ARBPL,
											AUERU: selectedItems[j].AssignmentFields.AUERU,
											AUFKZ: selectedItems[j].AssignmentFields.AUFKZ,
											AUTYP: selectedItems[j].AssignmentFields.AUTYP,
											AWART: selectedItems[j].AssignmentFields.AWART,
											BEGUZ: selectedItems[j].AssignmentFields.BEGUZ,
											BELNR: selectedItems[j].AssignmentFields.BELNR,
											BEMOT: selectedItems[j].AssignmentFields.BEMOT,
											BUDGET_PD: selectedItems[j].AssignmentFields.BUDGET_PD,
											BUKRS: selectedItems[j].AssignmentFields.BUKRS,
											BWGRL: selectedItems[j].AssignmentFields.BWGRL,
											CATSAMOUNT: selectedItems[j].AssignmentFields.CATSAMOUNT,
											CATSHOURS: selectedItems[j].AssignmentFields.CATSHOURS,
											CATSQUANTITY: selectedItems[j].AssignmentFields.CATSQUANTITY,
											CPR_EXTID: selectedItems[j].AssignmentFields.CPR_EXTID,
											CPR_GUID: selectedItems[j].AssignmentFields.CPR_GUID,
											CPR_OBJGEXTID: selectedItems[j].AssignmentFields.CPR_OBJGEXTID,
											CPR_OBJGUID: selectedItems[j].AssignmentFields.CPR_OBJGUID,
											CPR_OBJTYPE: selectedItems[j].AssignmentFields.CPR_OBJTYPE,
											ENDUZ: selectedItems[j].AssignmentFields.ENDUZ,
											ERNAM: selectedItems[j].AssignmentFields.ERNAM,
											ERSDA: selectedItems[j].AssignmentFields.ERSDA,
											ERSTM: selectedItems[j].AssignmentFields.ERSTM,
											ERUZU: selectedItems[j].AssignmentFields.ERUZU,
											EXTAPPLICATION: selectedItems[j].AssignmentFields.EXTAPPLICATION,
											EXTDOCUMENTNO: selectedItems[j].AssignmentFields.EXTDOCUMENTNO,
											EXTSYSTEM: selectedItems[j].AssignmentFields.EXTSYSTEM,
											FUNC_AREA: selectedItems[j].AssignmentFields.FUNC_AREA,
											FUND: selectedItems[j].AssignmentFields.FUND,
											GRANT_NBR: selectedItems[j].AssignmentFields.GRANT_NBR,
											HRBUDGET_PD: selectedItems[j].AssignmentFields.HRBUDGET_PD,
											HRCOSTASG: selectedItems[j].AssignmentFields.HRCOSTASG,
											HRFUNC_AREA: selectedItems[j].AssignmentFields.HRFUNC_AREA,
											HRFUND: selectedItems[j].AssignmentFields.HRFUND,
											HRGRANT_NBR: selectedItems[j].AssignmentFields.HRGRANT_NBR,
											HRKOSTL: selectedItems[j].AssignmentFields.HRKOSTL,
											HRLSTAR: selectedItems[j].AssignmentFields.HRLSTAR,
											KAPAR: selectedItems[j].AssignmentFields.KAPAR,
											KAPID: selectedItems[j].AssignmentFields.KAPID,
											KOKRS: selectedItems[j].AssignmentFields.KOKRS,
											LAEDA: selectedItems[j].AssignmentFields.LAEDA,
											LAETM: selectedItems[j].AssignmentFields.LAETM,
											LGART: selectedItems[j].AssignmentFields.LGART,
											LOGSYS: selectedItems[j].AssignmentFields.LOGSYS,
											LONGTEXT: selectedItems[j].AssignmentFields.LONGTEXT,
											LONGTEXT_DATA: selectedItems[j].AssignmentFields.LONGTEXT_DATA,
											LSTAR: selectedItems[j].AssignmentFields.LSTAR,
											LSTNR: selectedItems[j].AssignmentFields.LSTNR,
											LTXA1: selectedItems[j].AssignmentFields.LTXA1,
											MEINH: selectedItems[j].AssignmentFields.MEINH,
											OFMNW: selectedItems[j].AssignmentFields.OFMNW,
											OTYPE: selectedItems[j].AssignmentFields.OTYPE,
											PAOBJNR: selectedItems[j].AssignmentFields.PAOBJNR,
											PEDD: selectedItems[j].AssignmentFields.PEDD,
											PERNR: selectedItems[j].AssignmentFields.PERNR,
											PLANS: selectedItems[j].AssignmentFields.PLANS,
											POSID: selectedItems[j].AssignmentFields.POSID,
											PRAKN: selectedItems[j].AssignmentFields.PRAKN,
											PRAKZ: selectedItems[j].AssignmentFields.PRAKZ,
											PRICE: selectedItems[j].AssignmentFields.PRICE,
											RAPLZL: selectedItems[j].AssignmentFields.RAPLZL,
											RAUFNR: selectedItems[j].AssignmentFields.RAUFNR,
											RAUFPL: selectedItems[j].AssignmentFields.RAUFPL,
											REASON: selectedItems[j].AssignmentFields.REASON,
											REFCOUNTER: selectedItems[j].AssignmentFields.REFCOUNTER,
											REINR: selectedItems[j].AssignmentFields.REINR,
											RKDAUF: selectedItems[j].AssignmentFields.RKDAUF,
											RKDPOS: selectedItems[j].AssignmentFields.RKDPOS,
											RKOSTL: selectedItems[j].AssignmentFields.RKOSTL,
											RKSTR: selectedItems[j].AssignmentFields.RKSTR,
											RNPLNR: selectedItems[j].AssignmentFields.RNPLNR,
											RPROJ: selectedItems[j].AssignmentFields.RPROJ,
											RPRZNR: selectedItems[j].AssignmentFields.RPRZNR,
											SBUDGET_PD: selectedItems[j].AssignmentFields.SBUDGET_PD,
											SEBELN: selectedItems[j].AssignmentFields.SEBELN,
											SEBELP: selectedItems[j].AssignmentFields.SEBELP,
											SKOSTL: selectedItems[j].AssignmentFields.SKOSTL,
											SPLIT: selectedItems[j].AssignmentFields.SPLIT,
											SPRZNR: selectedItems[j].AssignmentFields.SPRZNR,
											STATKEYFIG: selectedItems[j].AssignmentFields.STATKEYFIG,
											STATUS: selectedItems[j].AssignmentFields.STATUS,
											S_FUNC_AREA: selectedItems[j].AssignmentFields.S_FUNC_AREA,
											S_FUND: selectedItems[j].AssignmentFields.S_FUND,
											S_GRANT_NBR: selectedItems[j].AssignmentFields.S_GRANT_NBR,
											TASKCOMPONENT: selectedItems[j].AssignmentFields.TASKCOMPONENT,
											TASKCOUNTER: selectedItems[j].AssignmentFields.TASKCOUNTER,
											TASKLEVEL: selectedItems[j].AssignmentFields.TASKLEVEL,
											TASKTYPE: selectedItems[j].AssignmentFields.TASKTYPE,
											TCURR: selectedItems[j].AssignmentFields.TCURR,
											TRFGR: selectedItems[j].AssignmentFields.TRFGR,
											TRFST: selectedItems[j].AssignmentFields.TRFST,
											UNIT: selectedItems[j].AssignmentFields.UNIT,
											UVORN: selectedItems[j].AssignmentFields.UVORN,
											VERSL: selectedItems[j].AssignmentFields.VERSL,
											VORNR: selectedItems[j].AssignmentFields.VORNR,
											VTKEN: selectedItems[j].AssignmentFields.VTKEN,
											WABLNR: selectedItems[j].AssignmentFields.WABLNR,
											WAERS: selectedItems[j].AssignmentFields.WAERS,
											WERKS: selectedItems[j].AssignmentFields.WERKS,
											WORKDATE: selectedItems[j].AssignmentFields.WORKDATE,
											WORKITEMID: selectedItems[j].AssignmentFields.WORKITEMID,
											WTART: selectedItems[j].AssignmentFields.WTART
										}
									},
									success: function (oDataReturn) {
										that.oDataReturnCount++;
										if (that.oDataReturnCount == selectedItems.length) {
											that.oDataReturnCount = 0;
											that.getTasks(false, that.minNavDate, that.maxNavDate);
											that.hideBusy();
											var toastMsg = that.oBundle.getText("assignmentsImported");
											sap.m.MessageToast.show(toastMsg, {
												duration: 3000
											});
										}
									},
									error: function (oError) {
										that.hideBusy();
										that.oErrorHandler.processError(oError);
									},
									changeSetId: "ImportAssignments",
									groupId: "ImportAssignments"
								};
								var keyNames = Object.keys(selectedItems[j].AssignmentFields);
								for (var k = 0; k < keyNames.length; k++) {
									obj.properties.AssignmentFields[keyNames[k]] = selectedItems[j].AssignmentFields[keyNames[k]];
								}
								that.oDataImportAssignmentsModel
									.createEntry(
										that.appendLocaleParameter("/AssignmentCollection"),
										obj);
							}
						}
						that.oDataImportAssignmentsModel.submitChanges({
							groupId: "ImportAssignments",
							changeSetId: "ImportAssignments"
						});
					}, true);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Triggered by the table's 'updateFinished' event: after new table
		 * data is available, this handler method updates the table counter.
		 * This should only happen if the update was successful, which is
		 * why this handler is attached to 'updateFinished' and not to the
		 * table's list binding's 'dataReceived' method.
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function (oEvent) {

		},

		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onPress: function (oEvent) {
			// The source is the list item that got pressed
		},

		onLongTextPost: function (oEvent) {
			var index = oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1];
			var okButton = oEvent.getSource().getParent().getAggregation('beginButton');
			var data = this.getModel('TimeData').getData();
			if (oEvent.getParameter('value')) {
				data[index].TimeEntryDataFields.LONGTEXT_DATA = oEvent.getParameter('value');
				data[index].TimeEntryDataFields.LONGTEXT = 'X';
				if (data[index].Counter !== "") {
					data[index].TimeEntryOperation = 'U';
				} else {
					data[index].TimeEntryOperation = 'C';
				}
				var oModel = new JSONModel(data);
				this.setModel(oModel, "TimeData");
				okButton.setEnabled(true);
			}
		},

		onTodoLongTextPost: function (oEvent) {
			var index = oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1];
			var okButton = oEvent.getSource().getParent().getAggregation('beginButton');
			var data = this.getModel('TodoList').getData();
			if (oEvent.getParameter('value')) {
				data[index].TimeEntryDataFields.LONGTEXT_DATA = oEvent.getParameter('value');
				data[index].TimeEntryDataFields.LONGTEXT = 'X';
				if (data[index].Counter !== "") {
					data[index].TimeEntryOperation = 'U';
				} else {
					data[index].TimeEntryOperation = 'C';
				}
				var oModel = new JSONModel(data);
				this.setModel(oModel, "TodoList");
				okButton.setEnabled(true);
			}
		},

		openQuickViewTodoFragment: function (oEvent) {
			var that = this;
			var timeData = this.getModel('TodoList').getData();
			var dataIndex = this.getModel('controls').getProperty('/index');

			var timeDataDates = {};
			var capturedSource = oEvent.getSource();

			//Checking for date if present in timeData
			var finalData = new Array(0);
			var currentSelectedDate = new Date(oEvent.getSource().getCustomData()[0].getProperty("value"));
			currentSelectedDate.setHours(0, 0, 0, 0);
			timeDataDates[currentSelectedDate.getTime()] = 1;
			this.getTimeEntriesOnDemand(new Date(currentSelectedDate)).then(function (result) {

				var results = result[0].TimeEntries.results;

				for (var i = 0; i < results.length; i++) {
					if (results[i].TimeEntryDataFields.STATUS == '10' || results[i].TimeEntryDataFields.STATUS == '40') {
						continue;
					}

					//checking fot non zero hours and begin time end time
					if (!Math.max(parseFloat(results[i].TimeEntryDataFields.CATSHOURS), parseFloat(results[i].TimeEntryDataFields.CATSQUANTITY),
							parseFloat(results[i].TimeEntryDataFields.CATSAMOUNT), parseFloat(results[i].TimeEntryDataFields.BEGUZ),
							parseFloat(results[i].TimeEntryDataFields.ENDUZ))) {
						continue;
					}
					finalData.push($.extend(true, {}, results[i]));
				}

				if (timeDataDates[currentSelectedDate.getTime()]) {
					//Date will come from timeData
					var timeDataEntry = $.grep(timeData, function (value) {
						var date = new Date(value.TimeEntryDataFields.WORKDATE);
						date.setHours(0, 0, 0, 0);
						if (date.getTime() === currentSelectedDate.getTime()) {
							return true;
						}
						return false;
					});

					for (var i = 0; i < timeDataEntry.length; i++) {
						//checking fot non zero hours and begin time end time

						if (!Math.max(parseFloat(timeDataEntry[i].TimeEntryDataFields.CATSHOURS), parseFloat(timeDataEntry[i].TimeEntryDataFields.CATSQUANTITY),
								parseFloat(timeDataEntry[i].TimeEntryDataFields.CATSAMOUNT), parseFloat(timeDataEntry[i].TimeEntryDataFields.BEGUZ),
								parseFloat(timeDataEntry[i].TimeEntryDataFields.ENDUZ))) {
							continue;
						}

						finalData.push($.extend(true, {}, timeDataEntry[i]));
						if (timeData[dataIndex] === timeDataEntry[i]) {
							// Row should not be enabled for the entry opened from form entry
							finalData[finalData.length - 1].enableRow = false;
							finalData[finalData.length - 1].TimeEntryDataFields.BEGUZ = '000000'; //Setting to initial start time
							finalData[finalData.length - 1].TimeEntryDataFields.ENDUZ = '000000'; //Setting to initial end time
							if (!parseFloat(finalData[finalData.length - 1].TimeEntryDataFields.CATSHOURS)) {
								// finalData[finalData.length - 1].TimeEntryDataFields.CATSQUANTITY = '0.000';
								// finalData[finalData.length - 1].TimeEntryDataFields.CATSAMOUNT = '0.00';
								finalData.pop();

							}

						} else {
							finalData[finalData.length - 1].enableRow = true;
						}
					}

				}

				finalData.forEach(function (value) {

					if (parseFloat(value.TimeEntryDataFields.CATSQUANTITY) !== 0) {
						value.TimeEntryDataFields.CATSAMOUNT = value.TimeEntryDataFields.CATSQUANTITY;
					}
					if (parseFloat(value.TimeEntryDataFields.CATSHOURS) !== 0) {
						value.TimeEntryDataFields.CATSAMOUNT = value.TimeEntryDataFields.CATSHOURS;
					}

					if (!value.AssignmentName) {
						value.AssignmentName = "   ";
					}

				});

				that.setModel(new JSONModel(finalData), 'RecordedVsTargetModel');
				if (that.oRecordedVsTargetQuickview) {
					that.oRecordedVsTargetQuickview.close();

				}
				// create dialog lazily
				if (!that.oRecordedVsTargetQuickview) {
					// create dialog via fragment factory
					that.oRecordedVsTargetQuickview = sap.ui.xmlfragment(that.getView().getId(),
						"hcm.fab.mytimesheet.view.fragments.RecordedVsTarget",
						that);
					// connect dialog to view (models, lifecycle)
					that.getView().addDependent(that.oRecordedVsTargetQuickview);
				}

				jQuery.sap.delayedCall(0, that, function () {
					that.oRecordedVsTargetQuickview.openBy(capturedSource);
				});
			});

		},

		openQuickViewFragment: function (oEvent) {
			var that = this;
			var dataIndex = this.getModel('controls').getProperty('/index');
			var timeData = this.getModel('TimeData').getData();
			var timeDataDates = {};
			//Looping at time data and checking for the selected dates
			for (var i = 0; i < timeData.length; i++) {
				var date = new Date(timeData[i].HeaderData.date);
				date.setHours(0, 0, 0, 0);
				timeDataDates[date.getTime()] = 1;
			}

			//Checking for date if present in timeData
			var finalData = new Array(0);
			var currentSelectedDate = new Date(oEvent.getSource().getCustomData()[0].getProperty("value"));
			currentSelectedDate.setHours(0, 0, 0, 0);
			if (timeDataDates[currentSelectedDate.getTime()]) {
				//Date will come from timeData
				var timeDataEntry = $.grep(timeData, function (value) {
					var date = new Date(value.HeaderData.date);
					date.setHours(0, 0, 0, 0);
					if (date.getTime() === currentSelectedDate.getTime()) {

						return true;
					}

					return false;
				});

				for (var i = 0; i < timeDataEntry.length; i++) {

					if (!Math.max(parseFloat(timeDataEntry[i].TimeEntryDataFields.CATSHOURS), parseFloat(timeDataEntry[i].TimeEntryDataFields.CATSQUANTITY),
							parseFloat(timeDataEntry[i].TimeEntryDataFields.CATSAMOUNT), parseFloat(timeDataEntry[i].TimeEntryDataFields.BEGUZ),
							parseFloat(timeDataEntry[i].TimeEntryDataFields.ENDUZ))) {
						continue;
					}
					finalData.push($.extend(true, {}, timeDataEntry[i]));
					if (timeData[dataIndex] === timeDataEntry[i]) {
						// Row should not be enabled for the entry opened from form entry
						finalData[finalData.length - 1].enableRow = false;
						finalData[finalData.length - 1].TimeEntryDataFields.BEGUZ = '000000'; //Setting to initial start time
						finalData[finalData.length - 1].TimeEntryDataFields.ENDUZ = '000000'; //Setting to initial end time
						if (!parseFloat(finalData[finalData.length - 1].TimeEntryDataFields.CATSHOURS)) {
							// finalData[finalData.length - 1].TimeEntryDataFields.CATSQUANTITY = '0.000';
							// finalData[finalData.length - 1].TimeEntryDataFields.CATSAMOUNT = '0.00';
							finalData.pop();

						}

					} else {
						finalData[finalData.length - 1].enableRow = true;
					}

				}
				//Adding the entry to be copied to each entry except that particular one
				var adHocDate = new Date(this.adHocStartDate);
				adHocDate.setHours(0, 0, 0, 0);
				if (adHocDate.getTime() !== currentSelectedDate.getTime()) {
					if (Math.max(parseFloat(timeData[dataIndex].TimeEntryDataFields.CATSHOURS), parseFloat(timeData[dataIndex].TimeEntryDataFields.CATSQUANTITY),
							parseFloat(timeData[dataIndex].TimeEntryDataFields.CATSAMOUNT), parseFloat(timeData[dataIndex].TimeEntryDataFields.BEGUZ),
							parseFloat(timeData[dataIndex].TimeEntryDataFields.ENDUZ))) {

						finalData.push($.extend(true, {}, timeData[dataIndex]));
						finalData[finalData.length - 1].enableRow = false;
						finalData[finalData.length - 1].TimeEntryDataFields.BEGUZ = '000000';
						finalData[finalData.length - 1].TimeEntryDataFields.ENDUZ = '000000';
						if (!parseFloat(finalData[finalData.length - 1].TimeEntryDataFields.CATSHOURS)) {
							// finalData[finalData.length - 1].TimeEntryDataFields.CATSQUANTITY = '0.000';
							// finalData[finalData.length - 1].TimeEntryDataFields.CATSAMOUNT = '0.00';
							finalData.pop();

						}

					}
				}

			} else {
				var timeDataEntry = $.grep(this.getModel('TimeEntries').getData(), function (value) {
					var date = new Date(value.CaleDate);
					date.setHours(0, 0, 0, 0);
					if (date.getTime() === currentSelectedDate.getTime()) {
						return true;
					}
					return false;
				});
				var results = timeDataEntry[0].TimeEntries.results;
				for (var i = 0; i < results.length; i++) {

					if (!Math.max(parseFloat(results[i].TimeEntryDataFields.CATSHOURS), parseFloat(results[i].TimeEntryDataFields.CATSQUANTITY),
							parseFloat(results[i].TimeEntryDataFields.CATSAMOUNT), parseFloat(results[i].TimeEntryDataFields.BEGUZ),
							parseFloat(results[i].TimeEntryDataFields.ENDUZ))) {
						continue;
					}

					finalData.push($.extend(true, {}, results[i]));
				}
				var adHocDate = new Date(this.adHocStartDate);
				adHocDate.setHours(0, 0, 0, 0);
				if (adHocDate.getTime() !== currentSelectedDate.getTime()) {
					if (Math.max(parseFloat(timeData[dataIndex].TimeEntryDataFields.CATSHOURS), parseFloat(timeData[dataIndex].TimeEntryDataFields.CATSQUANTITY),
							parseFloat(timeData[dataIndex].TimeEntryDataFields.CATSAMOUNT), parseFloat(timeData[dataIndex].TimeEntryDataFields.BEGUZ),
							parseFloat(timeData[dataIndex].TimeEntryDataFields.ENDUZ))) {

						finalData.push($.extend(true, {}, timeData[dataIndex]));
						finalData[finalData.length - 1].enableRow = false;
						finalData[finalData.length - 1].TimeEntryDataFields.BEGUZ = '000000';
						finalData[finalData.length - 1].TimeEntryDataFields.ENDUZ = '000000';
						if (!parseFloat(finalData[finalData.length - 1].TimeEntryDataFields.CATSHOURS)) {
							// finalData[finalData.length - 1].TimeEntryDataFields.CATSQUANTITY = '0.000';
							// finalData[finalData.length - 1].TimeEntryDataFields.CATSAMOUNT = '0.00';
							finalData.pop();

						}
					}
				}

			}

			finalData.forEach(function (value) {

				if (parseFloat(value.TimeEntryDataFields.CATSQUANTITY) !== 0) {
					value.TimeEntryDataFields.CATSAMOUNT = value.TimeEntryDataFields.CATSQUANTITY;
				}
				if (parseFloat(value.TimeEntryDataFields.CATSHOURS) !== 0) {
					value.TimeEntryDataFields.CATSAMOUNT = value.TimeEntryDataFields.CATSHOURS;
				}

				if (!value.AssignmentName) {
					value.AssignmentName = "   ";
				}

			});

			that.setModel(new JSONModel(finalData), 'RecordedVsTargetModel');
			if (that.oRecordedVsTargetQuickview) {
				that.oRecordedVsTargetQuickview.close();

			}
			// create dialog lazily
			if (!that.oRecordedVsTargetQuickview) {
				// create dialog via fragment factory
				that.oRecordedVsTargetQuickview = sap.ui.xmlfragment(that.getView().getId(),
					"hcm.fab.mytimesheet.view.fragments.RecordedVsTarget",
					that);
				// connect dialog to view (models, lifecycle)
				that.getView().addDependent(that.oRecordedVsTargetQuickview);
			}
			var oButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, that, function () {
				that.oRecordedVsTargetQuickview.openBy(oButton);
			});

		},

		handleRecordedVsTargetLinkPress: function (oEvent) {

			var that = this;
			var capturedSource = oEvent.getSource();
			var index = oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1];
			var timeData = this.getModel('TodoList').getData();
			if (oEvent)
				var selectedWorkdate = timeData[index].TimeEntryDataFields.WORKDATE;
			this.getTimeEntriesOnDemand(new Date(selectedWorkdate)).then(function () {

				//var timeEntriesData = that.getModel("OriginalTodo").oData;
				var timeEntriesData = that.getModel('onDemand').getData();
				var selectedDayEntries = timeEntriesData;
				if (that.oRecordedVsTargetQuickview) {
					that.oRecordedVsTargetQuickview.close();
				}
				// create dialog lazily
				if (!that.oRecordedVsTargetQuickview) {
					// create dialog via fragment factory
					that.oRecordedVsTargetQuickview = sap.ui.xmlfragment(that.getView().getId(),
						"hcm.fab.mytimesheet.view.fragments.RecordedVsTarget",
						that);
					// connect dialog to view (models, lifecycle)
					that.getView().addDependent(that.oRecordedVsTargetQuickview);
				}
				var recordedEntriesArray = [];
				try {
					for (var l = 0; l < selectedDayEntries[0].TimeEntries.results.length; l++) {
						if (selectedDayEntries[0].TimeEntries.results[l].TimeEntryDataFields.CATSHOURS != 0) {
							selectedDayEntries[0].TimeEntries.results[l].TimeEntryDataFields.CATSAMOUNT = selectedDayEntries[0].TimeEntries.results[l].TimeEntryDataFields
								.CATSHOURS;
						} else if (selectedDayEntries[0].TimeEntries.results[l].TimeEntryDataFields.CATSQUANTITY != 0) {
							selectedDayEntries[0].TimeEntries.results[l].TimeEntryDataFields.CATSAMOUNT = selectedDayEntries[0].TimeEntries.results[l].TimeEntryDataFields
								.CATSQUANTITY;
						}
						var data = $.extend(true, {}, selectedDayEntries[0].TimeEntries.results[l]);
						if (data.Status !== "10") {
							// If record is not in Draft status
							recordedEntriesArray.push(data);
						}
					}
				} catch (e) {
					//No data exist for that day
				}

				var oRVTModel = new sap.ui.model.json.JSONModel(recordedEntriesArray);
				that.setModel(oRVTModel, "RecordedVsTargetModel");
				var oButton = oEvent.getSource();
				jQuery.sap.delayedCall(0, that, function () {
					that.oRecordedVsTargetQuickview.openBy(capturedSource);
				});
			});
		},

		handleMessagePopover: function (oEvent) {
			var oMessageTemplate = new MessagePopoverItem({
				type: '{message>type}',
				description: " ",
				title: '{message>message}',
				link: new sap.m.Link({
					text: this.oBundle.getText("clickHere"),
					press: this.onClickFocusError.bind(this),
					visible: "{=${message>additionalText} === undefined ? false : true}",
					customData: [new sap.ui.core.CustomData({
						key: "counter",
						value: "{message>additionalText}"
					}), new sap.ui.core.CustomData({
						key: "code",
						value: "{message>code}"
					})]
				})
			});
			var oMessagePopover = new MessagePopover({
				items: {
					path: "message>/",
					template: oMessageTemplate
				}
			});
			this.oMessagePopover = oMessagePopover;
			this.oMessagePopover.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
			this.oMessagePopover.toggle(oEvent.getSource());

		},
		onClickFocusError: function (oEvent) {
			var that = this;
			var focusIndexFound = false;
			this.getModel('TimeData').refresh();
			var oRecRowNo = oEvent.getSource().getCustomData("counter")[0].getValue();
			var dataModel = oEvent.getSource().getCustomData("code")[1].getValue();
			var oEntries = this.getModel(dataModel).getData();
			var highlightedRecords = $.grep(oEntries, function (element, ind) {
				if (element.valueState) {
					return element.valueState === "Warning" || element.valueState === "Error" || element.valueState === "Information" ||
						"Success";
				}
			});
			// for (var i = 0; i < highlightedRecords.length; i++) {
			// 	highlightedRecords[i].valueState = "None";
			// }
			this.getModel('TimeData').updateBindings();
			this.getModel('TodoList').updateBindings();
			var entry = $.grep(oEntries, function (element, ind) {
				if (element.RecRowNo) {
					return element.RecRowNo === parseInt(oRecRowNo).toString();
				}
			});
			if (entry.length > 0) {
				//	entry[0].valueState = entry[0].highlight;
			}
			this.oMessagePopover.attachAfterClose(function () {
				try {
					if (entry.length > 0) {
						var item = $.grep(that.oTable.getItems(), function (element, index) {
							if (!element.getAggregation('cells')) {
								return false;
							} else {
								return true;
							}
						});
						var oData = that.getModel('TimeData').getData();
						for (var focusIndex = 0; focusIndex < oData.length; focusIndex++) {
							if (oData[focusIndex] === entry[0]) {
								item[focusIndex].focus();
								focusIndexFound = true;
								break;
							}
						}
						if (!focusIndexFound) {
							var item = $.grep(that.oToDoTable.getItems(), function (element, index) {
								if (!element.getAggregation('cells')) {
									return false;
								} else {
									return true;
								}
							});
							var oTodoData = that.getModel('TodoList').getData();
							for (var focusIndex = 0; focusIndex < oTodoData.length; focusIndex++) {
								if (oTodoData[focusIndex] === entry[0]) {
									item[focusIndex].focus();
									break;

								}
							}

						}

					}
				} catch (e) {

				}
			});
			this.getModel('TimeData').updateBindings();
			this.getModel('TodoList').updateBindings();
			this.oMessagePopover.close();
		},
		onTodoAdHocCopy: function (oEvent) {
			var oControl = this.getModel("controls");
			var index = oControl.getProperty('/index');
			var data = this.getModel('TodoList').getData();
			data = this.calculateSumToDo(new Date(data[index].TimeEntryDataFields.WORKDATE), data);
			this.rebindTableWithTemplate(this.oToDoTable, "TodoList>/", this.oEditableToDoTemplate, "Edit");
			this.resetTodoAdHocControls();

			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/todoDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/todoDataChanged", false);
				this.getModel("controls").setProperty("/todoDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isToDoChanged", true);
				this.getModel("controls").setProperty("/todoDataChanged", true);
			}
			this.successfulToDoCheck = "";

		},
		onAdHocCopy: function (oEvent) {
			//	this.calendar.getSelectedDates();
			var oControl = this.getModel("controls");
			var index = this.getModel('controls').getProperty('/index');
			var data = this.getModel('TimeData').getData();
			data = this.calculateSum(new Date(data[index].TimeEntryDataFields.WORKDATE), data);

			if (!this.adHocSelectedDates || this.adHocSelectedDates.length === 1) {
				this.calculateSum(new Date(data[index].TimeEntryDataFields.WORKDATE), data);
				this.oTable.bindItems({
					path: 'TimeData>/',
					sorter: [new sap.ui.model.Sorter("HeaderData", false, true, this.compareRowsAdHoc)],
					template: this.oEditableTemplate,
					templateShareable: true,
					key: "overviewBind",
					groupHeaderFactory: this.getGroupHeader.bind(this)
				}).setKeyboardMode('Edit');
				if (sap.ui.Device.system.phone === true) {
					this.mCalendar.destroySelectedDates();
				} else {
					this.calendar.destroySelectedDates();
				}
				//Setting calendar selection as whole is older case was not multiple
				if (!this.getModel("controls").getProperty('/isOlderMultipleDays')) {
					oControl.setProperty("/duplicateScreen", false);

					if (sap.ui.Device.system.phone === true) {
						this.calendarSelection(this.mCalendar, new Date(this.startdate), new Date(this.enddate));
					} else {
						this.calendarSelection(this.calendar, new Date(this.startdate), new Date(this.enddate));
					}
				} else {
					oControl.setProperty("/duplicateScreen", true);
				}
				//Resetting the calendar selections
				var olderMultiple = this.getModel("controls").getProperty("/isOlderMultipleDays");
				//	this.adHocSelectedDates = new Array(0);
				this.resetAdHocControls();
				this.enableSubmit();

				this.getModel("controls").setProperty("/isOlderMultipleDays", olderMultiple);

				return;
			}
			var that = this;
			var selectedDates = {};
			var index = this.getModel('controls').getProperty('/index');
			// this.adHocSelectedDates

			// var mainDate = new Date(this.adHocSelectedDates[0].getStartDate());
			// var mainData = $.extend(true, {}, this.getModel('TimeData').getData()[index]);

			var oData = this.getModel("adHocCreateCopy").getData();
			for (var i = 1; i < this.adHocSelectedDates.length; i++) {

				var date = new Date(this.adHocSelectedDates[i].getStartDate());
				date.setHours(0, 0, 0, 0);
				selectedDates[date.getTime()] = true;

			}

			for (var i = 1; i < oData.length && i > 0; i++) {
				var date = oData[i].date;
				date.setHours(0, 0, 0, 0);
				if (selectedDates[date.getTime()]) {
					delete selectedDates[date.getTime()];
				}

				//Otherwise case of delete 
				else {
					oData.splice(i, 1);
					i--;
				}

			}
			//Now selectedDates will have only new Dates to copy
			//Fetching the dates record and copying at the same time
			var selectedDatesData = $.grep(this.getModel('TimeEntries').getData(), function (value) {
				var date = new Date(value.CaleDate);
				if (selectedDates[date.getTime()]) {
					if (value.TimeEntries.results.length === 0) {
						var data = $.extend(true, {}, oData[0]);
						data = data.data;

						data.Counter = "";
						data.TimeEntryOperation = 'C';
						data.TimeEntryDataFields.STATUS = "";
						data.TimeEntryDataFields.LONGTEXT = "";
						data.TimeEntryDataFields.LONGTEXT_DATA = "";
						data.TimeEntryDataFields.UNIT = "";
						data.TimeEntryDataFields.MEINH = "";
						data.HeaderData.date = new Date(date);
						data.HeaderData.key = new Date(date);
						data.highlight = sap.ui.core.MessageType.Information;
						data.HeaderData.highlight = sap.ui.core.MessageType.Information;
						data.HeaderData.addButton = false;
						data.addButton = false;
						data.target = value.TargetHours;
						data.totalHours = data.TimeEntryDataFields.CATSHOURS;
						data.HeaderData.target = value.TargetHours;
						data.HeaderData.sum = data.TimeEntryDataFields.CATSHOURS;
						data.TimeEntryDataFields.WORKDATE = new Date(date);
						data.TimeEntryDataFields.STATUS = "";
						data.Status = "";
						oData.push({
							date: date,
							data: data,
							target: data.HeaderData.sum,
							total: data.HeaderData.target

						});

					} else {
						var sum = 0;
						var target = value.TargetHours;
						for (var i = 0; i < value.TimeEntries.results.length; i++) {
							sum = sum + parseFloat(value.TimeEntries.results[i].TimeEntryDataFields.CATSHOURS);
						}
						var data = $.extend(true, {}, oData[0]);
						data = data.data;

						data.Counter = "";
						data.TimeEntryOperation = 'C';
						data.TimeEntryDataFields.STATUS = "";
						data.TimeEntryDataFields.LONGTEXT = "";
						data.TimeEntryDataFields.LONGTEXT_DATA = "";
						data.TimeEntryDataFields.UNIT = "";
						data.TimeEntryDataFields.MEINH = "";
						data.HeaderData.date = new Date(date);
						data.HeaderData.key = new Date(date);
						data.highlight = sap.ui.core.MessageType.Information;
						data.HeaderData.highlight = sap.ui.core.MessageType.Information;
						data.HeaderData.addButton = false;
						data.addButton = false;
						data.target = value.TargetHours;
						data.totalHours = sum + "";
						data.TimeEntryDataFields.STATUS = "";
						data.HeaderData.target = value.TargetHours;
						data.HeaderData.sum = sum + "";
						data.Status = "";

						data.TimeEntryDataFields.WORKDATE = new Date(date);
						oData.push({
							date: date,
							data: data,
							recorded: data.HeaderData.sum,
							target: data.HeaderData.target

						});
						return true;

					}
				}
				return false;
			});

			//Now refreshing the model
			this.getModel("adHocCreateCopy").refresh();

			//Fetching first and last day of week
			var firstDayOfWeek = this.getFirstDayOfWeek(new Date(that.adHocStartDate), this.getGlobalModel("firstDayOfWeek").getData().day);
			var endDateOfWeek = this.getLastDayOfWeek(new Date(that.adHocStartDate), this.getGlobalModel("firstDayOfWeek").getData().day);

			//Start Date of Week should be same as end Date of Week
			if (sap.ui.Device.system.phone === true) {
				endDateOfWeek = new Date(this.adHocStartDate);
				endDateOfWeek.setHours(0, 0, 0, 0);
				firstDayOfWeek = new Date(this.adHocStartDate);
				firstDayOfWeek.setHours(0, 0, 0, 0);
			}

			//looping at the adHocCreateCopy Model Data and fetching the records
			var finalData = this.getModel("adHocCreateCopy").getData();
			var timeData = new Array(0);
			var dateFromTableEntries = {};
			for (var i = 0; i < this.getModel('TimeData').getData().length; i++) {
				var date = new Date(this.getModel('TimeData').getData()[i].HeaderData.date);
				date.setHours(0, 0, 0, 0);
				dateFromTableEntries[date.getTime()] = 1;
			}

			for (var i = 0; i < finalData.length; i++) {
				var date = new Date(finalData[i].date);
				that.adHocStartDate.setHours(0, 0, 0, 0);
				date.setHours(0, 0, 0, 0);
				if (dateFromTableEntries[date.getTime()]) {

					var timeEntryData = $.grep(that.getModel('TimeData').getData(), function (value, index) {
						var currentDate = new Date(value.HeaderData.date);
						currentDate.setHours(0, 0, 0, 0);
						if (currentDate.getTime() === date.getTime() && (value.Status || value.TimeEntryOperation)) {
							return true;
						}
						return false;

					});

					for (var j = 0; j < timeEntryData.length; j++) {
						timeEntryData[j] = $.extend(true, {}, timeEntryData[j]);
						timeEntryData[j].addButton = false;
						timeEntryData[j].HeaderData.addButton = false;
						timeEntryData[j].HeaderData.date.setHours(0, 0, 0, 0);
						timeEntryData[j].addButtonEnable = false;
						timeEntryData[j].deleteButton = true;
						timeEntryData[j].deleteButtonEnable = true;
						timeEntryData[j].HeaderData.target = timeEntryData[j].target;

					}

					//checking for the same date
					if (date.getTime() !== that.adHocStartDate.getTime()) {

						timeEntryData.push(finalData[i].data);
					}

					timeEntryData = that.calculateSum(new Date(date), timeEntryData);

					for (var j = 0; j < timeEntryData.length; j++) {
						timeData.push(timeEntryData[j]);
					}
					var rec = timeData[timeData.length - 1];
					rec.addButton = true;
					rec.HeaderData.addButton = true;
					rec.addButtonEnable = true;
					rec.HeaderData.date.setHours(0, 0, 0, 0);
					rec.deleteButton = true;
					rec.deleteButtonEnable = true;
					rec.HeaderData.target = rec.target;
					timeData[timeData.length - 1] = rec;

				} else {
					var timeEntryDataCopy = new Array(0);
					var timeEntryData = $.grep(that.getModel('TimeEntries').getData(), function (value, index) {
						var currentDate = new Date(value.CaleDate);
						currentDate.setHours(0, 0, 0, 0);
						if (currentDate.getTime() === date.getTime()) {
							return true;
						}
						return false;

					});

					for (var j = 0; j < timeEntryData.length; j++) {
						timeEntryData[j] = $.extend(true, {}, timeEntryData[j]);
						var HeaderData = {
							"addButton": "",
							"date": "",
							"highlight": "",
							"key": "",
							"sum": "",
							"target": ""

						};
						HeaderData.addButton = false;
						HeaderData.date = new Date(timeEntryData[j].CaleDate);
						HeaderData.highlight = false;
						HeaderData.key = new Date(timeEntryData[j].CaleDate);
						HeaderData.sum = "";
						HeaderData.target = (timeEntryData[j].TargetHours);
						//timeEntryData[j] = timeEntryData[j].TimeEntries.results;
						var results = timeEntryData[j].TimeEntries.results;

						//Iterating over the results

						for (var k = 0; k < results.length; k++) {
							results[k].HeaderData = HeaderData;
							results[k].target = HeaderData.target;
							if (results[k].Status === "10") {
								results[k].SetDraft = true;
							} else {
								results[k].SetDraft = false;
							}

							results[k].addButton = false;
							results[k].HeaderData.addButton = false;
							results[k].HeaderData.date.setHours(0, 0, 0, 0);
							results[k].addButtonEnable = false;
							results[k].deleteButton = true;
							results[k].deleteButtonEnable = true;

							timeEntryDataCopy.push(results[k]);
						}

					}
					finalData[i].data.addButton = true;
					finalData[i].data.HeaderData.addButton = false;
					finalData[i].data.HeaderData.date.setHours(0, 0, 0, 0);
					finalData[i].data.addButtonEnable = true;
					finalData[i].data.deleteButton = true;
					finalData[i].data.deleteButtonEnable = true;
					finalData[i].data.HeaderData.target = finalData[i].data.target;
					timeEntryDataCopy.push(finalData[i].data);

					timeEntryData = that.calculateSum(new Date(date), timeEntryDataCopy);
					for (var j = 0; j < timeEntryData.length; j++) {
						timeData.push(timeEntryData[j]);
					}

				}

			}

			//Now pushing the changed and updated records from the table only
			var datesChangedRecords = {};
			var timeDataValue = this.getModel('TimeData').getData();
			for (var i = 0; i < timeDataValue.length; i++) {
				//Not push same Date Records
				if (selectedDates[timeDataValue[i].HeaderData.date.getTime()] || timeDataValue[i].HeaderData.date.getTime() === this.adHocStartDate
					.getTime()) {

				} else {
					if (timeDataValue[i].TimeEntryOperation === "U" || timeDataValue[i].TimeEntryOperation === "C") {
						var date = new Date(timeDataValue[i].HeaderData.date);
						date.setHours(0, 0, 0, 0);
						datesChangedRecords[date.getTime()] = 1;
					}
				}

			}
			//Now iterating and pushing the desired records
			for (var i = 0; i < timeDataValue.length; i++) {
				var date = new Date(timeDataValue[i].HeaderData.date);
				date.setHours(0, 0, 0, 0);

				if (datesChangedRecords[date.getTime()]) {
					timeData.push(timeDataValue[i]);
				}

			}
			//Sorting based on dates for proper focus handling inside the warning or error messages in case of check
			timeData = timeData.sort(function (val1, val2) {
				var date1 = new Date(val1.HeaderData.date);
				var date2 = new Date(val2.HeaderData.date);
				date1.setHours(0, 0, 0, 0);
				date2.setHours(0, 0, 0, 0);

				if (date1.getTime() === date2.getTime()) {
					return 0;
				}
				if (date1.getTime() < date2.getTime()) {
					return -1;
				}

				return 1;

			});

			this.getModel('TimeData').setData(timeData);
			this.oTable.bindItems({
				path: 'TimeData>/',
				sorter: [new sap.ui.model.Sorter("HeaderData", false, true, this.compareRowsAdHoc)],
				template: this.oEditableTemplate,
				templateShareable: true,
				key: "overviewBind",
				groupHeaderFactory: this.getGroupHeader.bind(this)
			}).setKeyboardMode('Edit');
			that.resetAdHocControls();
			//Destroying calendar dates
			if (sap.ui.Device.system.phone === true) {
				this.mCalendar.destroySelectedDates();
			} else {
				this.calendar.destroySelectedDates();
			}
			this.adHocSelectedDates = new Array(0);
			this.getModel('controls').setProperty('/isOlderMultipleDays', true);
			oControl.setProperty("/duplicateScreen", true);
			that.enableSubmit();

		},

		handleCalendarSelect: function (oEvent) {
			//Check for adHoc Selection
			var that = this;
			var oControl = this.getModel("controls");
			if (this.getModel("controls").getProperty('/currentAdHoc')) {
				//Adding the current date always in case it is deselected
				var currentDate = new Date(this.adHocStartDate);
				currentDate.setHours(0, 0, 0, 0);

				if (oEvent.getSource().getSelectedDates().length === 0) {
					oEvent.getSource().addSelectedDate(new sap.ui.unified.DateRange({
						startDate: new Date(currentDate)
					}));
				}
				var selectedDates = oEvent.getSource().getSelectedDates();
				this.adHocSelectedDates = selectedDates;

				var calendarFirstDateSelected = new Date(this.adHocSelectedDates[0].getStartDate());
				calendarFirstDateSelected.setHours(0, 0, 0, 0);
				if (new Date(calendarFirstDateSelected).getTime() !== new Date(currentDate).getTime()) {
					//Destroy all the dates and in sequence
					oEvent.getSource().removeAllSelectedDates();
					oEvent.getSource().addSelectedDate(new sap.ui.unified.DateRange({
						startDate: new Date(currentDate)
					}));
					for (var i = 0; i < this.adHocSelectedDates.length; i++) {
						oEvent.getSource().addSelectedDate(new sap.ui.unified.DateRange({
							startDate: new Date(this.adHocSelectedDates[i].getStartDate())
						}));
					}
				}
				var selectedDates = oEvent.getSource().getSelectedDates();
				this.adHocSelectedDates = selectedDates;

				var adHocDates = [];
				this.setModel(new JSONModel(adHocDates), "adHocCopyDates");
				//Making the adHocDates as Special dates except for the day for which adhoc is opened
				for (var i = 0; i < this.adHocSelectedDates.length; i++) {
					adHocDates.push(new Date(this.adHocSelectedDates[i].getStartDate()));
					// oEvent.getSource().addSpecialDate(
					// 	new sap.ui.unified.DateTypeRange({
					// 		startDate: new Date(that.adHocSelectedDates[i].getStartDate()),
					// 		color: "#000000",
					// 		tooltip: "Copied Dates"
					// 	}));
				}
				if (that.adHocSelectedDates.length === 1) {
					oControl.setProperty("/duplicateScreen", false);

				} else {
					oControl.setProperty("/duplicateScreen", true);

				}
				this.getModel("adHocCopyDates").setData(adHocDates);
				this.getModel("adHocCopyDates").refresh();
				//Fetching the time entries for the adHocDates
				//Checking whether to retireve from timedata model or time entries
				var dateFromTableEntries = {};
				var recordedTarget = {};
				for (var i = 0; i < this.getModel('TimeData').getData().length; i++) {
					var date = new Date(this.getModel('TimeData').getData()[i].HeaderData.date);
					date.setHours(0, 0, 0, 0);
					dateFromTableEntries[date.getTime()] = 1; //checking for dates from timedata model
				}
				var arrofPromise = [];
				adHocDates.forEach(function (element, value) {
					if (value === 0) {
						return;
					}

					//Checking from time data
					arrofPromise.push(new Promise(function (fnResolve, fnReject) {
						var date = new Date(element);
						date.setHours(0, 0, 0, 0);
						if (dateFromTableEntries[date.getTime()]) {
							var timeData = $.grep(that.getModel('TimeData').getData(), function (value) {
								var newDate = new Date(value.HeaderData.date);
								newDate.setHours(0, 0, 0, 0);
								if (newDate.getTime() === date.getTime()) {
									return true;
								}
								return false;
							});
							//Now we will have the results for that particular date
							for (var j = 0; j < timeData.length; j++) {
								var newDate = new Date(date);
								newDate.setHours(0, 0, 0, 0);
								recordedTarget[date] = {
									date: newDate,
									recorded: timeData[j].totalHours,
									target: timeData[j].target
								};
							}
							fnResolve(recordedTarget[date]);

						} else {
							//Checking in timeEntries for the data

							var timeEntry = $.grep(that.getModel('TimeEntries').getData(), function (value) {
								var newDate = new Date(value.CaleDate);
								newDate.setHours(0, 0, 0, 0);
								if (newDate.getTime() === date.getTime()) {
									return true;
								}
								return false;
							});
							if (timeEntry.length === 0) {
								if (that.adHocDemandEntries[date.getTime()]) {
									timeEntry = [that.adHocDemandEntries[date.getTime()]];
									that.getModel('TimeEntries').getData().push(timeEntry[0]);
								}
							}

							if (timeEntry.length !== 0) {
								for (var j = 0; j < timeEntry.length; j++) {
									var results = timeEntry[j].TimeEntries.results;
									var target = timeEntry[j].TargetHours;
									var sum = 0.0;
									var newDate = new Date(date);
									newDate.setHours(0, 0, 0, 0);

									for (var k = 0; k < results.length; k++) {
										if (results[k].Status !== '40') {
											sum = parseFloat(sum) + parseFloat(results[k].TimeEntryDataFields.CATSHOURS);
											sum = parseFloat(sum).toFixed(2);
										}

										recordedTarget[date] = {
											date: newDate,
											recorded: sum + "",
											target: target
										};
									}
									if (results.length === 0) {
										recordedTarget[date] = {
											date: newDate,
											recorded: sum + "",
											target: target
										};
									}
								}
								fnResolve(recordedTarget[date]);
							} else {
								that.getTimeEntriesOnDemand(new Date(date)).then(function (data) {
									var timeEntry = data;
									for (var j = 0; j < timeEntry.length; j++) {
										var results = timeEntry[j].TimeEntries.results;
										var target = timeEntry[j].TargetHours;
										var sum = 0.0;
										var newDate = new Date(date);
										newDate.setHours(0, 0, 0, 0);

										for (var k = 0; k < results.length; k++) {
											if (results[k].Status !== '40') {
												sum = parseFloat(sum) + parseFloat(results[k].TimeEntryDataFields.CATSHOURS);
												sum = parseFloat(sum).toFixed(2);
											}

											recordedTarget[date] = {
												date: newDate,
												recorded: sum + "",
												target: target
											};
										}
										if (results.length === 0) {
											recordedTarget[date] = {
												date: newDate,
												recorded: sum + "",
												target: target
											};
										}
									}
									data[0].CaleDate = new Date(data[0].CaleDate.substring(0, 4) + "-" + data[0].CaleDate.substring(
											4,
											6) + "-" +
										data[0].CaleDate.substring(6, 8));
									data[0].CaleDate = new Date(data[0].CaleDate.getUTCFullYear(), data[0].CaleDate.getUTCMonth(),
										data[0].CaleDate.getUTCDate());
									that.getModel('TimeEntries').getData().push(data[0]);
									fnResolve(recordedTarget[date]);

								});
							}
						}
					}));

				});

				Promise.all(arrofPromise).then(function (results) {
					results.splice(0, 0, that.getModel('adHocTotalTarget').getData()[0]);

					//Making all dates hours as  live change for the step input control
					for (var i = 1; i < results.length; i++) {
						results[i].updated = parseFloat(that.getModel('TimeData').getData()[that.getModel('controls').getProperty('/index')].TimeEntryDataFields
							.CATSHOURS);
						results[i].updated = results[i].updated.toFixed(2);

					}
					that.setModel(new JSONModel(results), 'adHocTotalTarget');
					//	this.setModel(new JSONModel(adHocDates), 'Dates');
					if (adHocDates.length) {
						that.getModel("controls").setProperty("/singleAdHocDay", false);
						that.getModel("controls").setProperty("/currentDate", that.formEntryName);
					} else {
						that.getModel("controls").setProperty("/singleAdHocDay", true);
						that.getModel("controls").setProperty("/currentDate", that.formEntryName);
					}

					//	this.onAdHocCopy();
					that.getModel("controls").setProperty("/adHocCopy", true);

				});

				return;
			}
			//Checking for same week selection 
			if (that.dailyView === "X" || sap.ui.Device.system.phone === true) {
				var oDate = oEvent.getSource().getSelectedDates()[0].getStartDate();
				if (oDate.getMonth() === this.startdate.getMonth() && oDate.getDate() === this.startdate.getDate() && oDate.getYear() === this.startdate
					.getYear()) {
					//We will simply return because the same date is already open
					this.calendarSelection(oEvent.getSource(), new Date(this.startdate), new Date(this.startdate));
					return;
				}
			} else {
				var caleDate = oEvent.getSource().getSelectedDates()[0].getStartDate();
				var oStartDateCalendar = this.getFirstDayOfWeek(caleDate, this.firstDayOfWeek);
				var oEndDateCalendar = this.getLastDayOfWeek(caleDate, this.firstDayOfWeek);
				var oStartDate = new Date(this.startdate);
				var oEndDate = new Date(this.enddate);
				oStartDateCalendar.setHours(0, 0, 0, 0);
				oEndDateCalendar.setHours(0, 0, 0, 0);
				oStartDate.setHours(0, 0, 0, 0);
				oEndDate.setHours(0, 0, 0, 0);
				if (oStartDate.getTime() === oStartDateCalendar.getTime() && oEndDate.getTime() === oEndDateCalendar.getTime()) {
					//We will simply return because the same date is already part of sele
					this.calendarSelection(oEvent.getSource(), new Date(this.startdate), new Date(this.enddate));
					return;
				}

			}
			var oDateModel1 = this.getModel("lastSelectModel").getData();
			var that = this;
			var oControl = this.getModel('controls');
			//Making filter active to All records
			this.getView().byId("filterCombo").setSelectedKey("100"); //Making the selection as All in filter
			oControl.setProperty('/overviewEditEnabled', true); //Making the enter records control visible
			if (sap.ui.Device.system.phone === true) {
				var oCalendar = oEvent.getSource();
				var aSelectedDates = oCalendar.getSelectedDates();
				this.mCalendar.destroySelectedDates();
				this.startdate = aSelectedDates[0].getStartDate();
				this.enddate = aSelectedDates[0].getStartDate();
				// this.startdate = new Date(this.startdate.getUTCFullYear(), this.startdate.getUTCMonth(), this.startdate.getUTCDate());
				// this.enddate = new Date(this.enddate.getUTCFullYear(), this.enddate.getUTCMonth(), this.enddate.getUTCDate());

				this.calendarSelection(oCalendar, new Date(this.startdate), new Date(this.enddate));
				this.bindTable(new Date(this.startdate), new Date(this.enddate));
				if (this.oReadOnlyTemplate) {
					this.rebindTableWithTemplate(this.oTable, "TimeData>/", this.oReadOnlyTemplate, "Navigation");
					that.getEnteredHours(false);

				}
			} else {
				var oCalendar = oEvent.getSource();
				var aSelectedDates = oCalendar.getSelectedDates();
				this.calendar.destroySelectedDates();
				if (that.dailyView === "X") {
					this.startdate = aSelectedDates[0].getStartDate();
					this.enddate = aSelectedDates[0].getStartDate();
				} else {
					oDateModel1.preSelect = this.startdate;
					oDateModel1.endSelect = this.enddate;
					this.startdate = this.getFirstDayOfWeek(aSelectedDates[0].getStartDate(), this.firstDayOfWeek);
					this.enddate = this.getLastDayOfWeek(aSelectedDates[0].getStartDate(), this.firstDayOfWeek);
				}
				this.calendarSelection(oCalendar, new Date(this.startdate), new Date(this.enddate));
				// this.startdate = new Date(this.startdate.getUTCFullYear(), this.startdate.getUTCMonth(), this.startdate.getUTCDate());
				// this.enddate = new Date(this.enddate.getUTCFullYear(), this.enddate.getUTCMonth(), this.enddate.getUTCDate());
				var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
				if (oControl.getProperty("/isOverviewChanged") === true || oControl.getProperty("/overviewDataChangedWithCheck") === true) { // || oControl.getProperty("/overviewDataChanged") === true ) {
					sap.m.MessageBox.warning(
						that.oBundle.getText("confirmationSwitchTabGeneral"), {
							title: that.oBundle.getText("confirm"),
							actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
							styleClass: bCompact ? "sapUiSizeCompact" : "",
							onClose: function (sAction) {
								if (sAction === "CANCEL") {
									that.calendarSelection(oCalendar, new Date(oDateModel1.preSelect), new Date(oDateModel1.endSelect));
									that.startdate = oDateModel1.preSelect;
									that.enddate = oDateModel1.endSelect;
									//that.bindTable(new Date(that.prestartdate), new Date(that.preenddate));
									oControl.setProperty('/onEdit', "None");
									oControl.setProperty("/sendForApprovalCheck", true);
									oControl.setProperty("/sendForApproval", true);
									oControl.setProperty("/overviewCancel", true);
									oControl.setProperty('/duplicateVisibility', true);
									if (that.dailyView !== "X") {
										oControl.setProperty('/duplicateWeekVisibility', true);
									}
									oControl.setProperty('/overviewEdit', false);
									oControl.setProperty('/showFooter', true);
								} else {
									that.calendarSelection(oCalendar, new Date(that.startdate), new Date(that.enddate));
									that.bindTable(new Date(that.startdate), new Date(that.enddate));
									if (that.oReadOnlyTemplate) {
										that.rebindTableWithTemplate(that.oTable, "TimeData>/", that.oReadOnlyTemplate, "Navigation");
										that.getEnteredHours(false);

									}
									if (that.checkButtonNeeded === "X") {
										oControl.setProperty('/overviewDataChangedWithCheck', false);
									}
									oControl.setProperty('/overviewDataChanged', false);
									oControl.setProperty('/isOverviewChanged', false);
									sap.ushell.Container.setDirtyFlag(false);
									oControl.setProperty('/onEdit', "None");
									oControl.setProperty('/duplicateVisibility', false);
									oControl.setProperty('/duplicateWeekVisibility', false);
									oControl.setProperty('/overviewEdit', true);
									if (!sap.ui.Device.system.phone) {
										oControl.setProperty('/showFooter', false);
									}
								}
							}
						}

					);
				} else {
					var startdate = new Date(this.startdate);
					var enddate = new Date(this.enddate);
					var minDate = that.timeEntries[0].CaleNavMinDate;
					var maxDate = that.timeEntries[0].CaleNavMaxDate;

					minDate.setHours(startdate.getHours(), startdate.getMinutes(), startdate.getSeconds(), startdate.getMilliseconds());
					maxDate.setHours(enddate.getHours(), enddate.getMinutes(), enddate.getSeconds(), enddate.getMilliseconds());

					if (!(startdate.getTime() < minDate.getTime() || startdate.getTime() > maxDate.getTime())) {
						this.bindTable(new Date(this.startdate), new Date(this.enddate));
						this.getEnteredHours(false);

					}

					if (this.oReadOnlyTemplate) {
						this.rebindTableWithTemplate(this.oTable, "TimeData>/", this.oReadOnlyTemplate, "Navigation");
						this.getEnteredHours(false);

					}
				}

			}
			oControl.setProperty('/onEdit', "None");
			oControl.setProperty("/sendForApprovalCheck", false);
			oControl.setProperty("/sendForApproval", false);
			oControl.setProperty("/overviewCancel", false);
			oControl.setProperty('/duplicateVisibility', false);
			oControl.setProperty('/duplicateWeekVisibility', false);
			oControl.setProperty('/overviewEdit', true);
			if (!sap.ui.Device.system.phone) {
				oControl.setProperty('/showFooter', false);
			}
		},
		handleDuplicateWeekCalendar: function (oEvent) {
			var oCalendar = oEvent.getSource();
			var aSelectedDates = oCalendar.getSelectedDates();
			var dateFrom = this.getFirstDayOfWeek(aSelectedDates[0].getStartDate(), this.firstDayOfWeek);
			var dateTo = this.getLastDayOfWeek(aSelectedDates[0].getStartDate(), this.firstDayOfWeek);
			this.duplicateWeekCalendar(oCalendar, dateFrom, dateTo);
			var oDate;
			var oData = {
				selectedWeek: []
			};
			var oModel = new JSONModel();

			if (this.getModel("selectedDatesDupWeek")) {
				var data = this.getModel("selectedDatesDupWeek").getData();
				var search = $.grep(data.selectedWeek, function (element, index) {
					return element.dateFrom.toDateString() === dateFrom.toDateString();
				});
				if (search.length === 0) {
					data.selectedWeek.push({
						dateFrom: dateFrom,
						dateTo: dateTo
					});
				}
				oModel.setData(data);
			} else {
				oData.selectedWeek.push({
					dateFrom: dateFrom,
					dateTo: dateTo
				});
				oModel.setData(oData);
			}
			this.setModel(oModel, "selectedDatesDupWeek");
			this.getModel('controls').setProperty("/duplicateWeekButtonEnable", true);
		},

		calendarSelection: function (oCalendar, startDate, endDate) {
			oCalendar.destroySelectedDates();
			var selectedDates = new sap.ui.unified.DateRange();
			selectedDates.setStartDate(startDate);
			selectedDates.setEndDate(endDate);
			oCalendar.addSelectedDate(selectedDates);
		},

		duplicateWeekCalendar: function (oCalendar, startDate, endDate) {
			oCalendar.destroySelectedDates();
			var selectedDates = new sap.ui.unified.DateRange();
			selectedDates.setStartDate(startDate);
			selectedDates.setEndDate(endDate);
			oCalendar.addSelectedDate(selectedDates);
		},

		bindTable: function (startDate, endDate) {
			var that = this;
			this.oTable.setBusy(true);
			var entries = $.extend(true, [], this.getModel('TimeEntries').getData());
			var oModel = new sap.ui.model.json.JSONModel();
			var timedata = [];
			var statusdata = [{
				key: '100',
				text: '{i18n>allStatus}'
			}, {
				key: '10'
			}, {
				key: '20'
			}, {
				key: '30'
			}, {
				key: '40'
			}];
			for (var i = startDate; i <= endDate; i.setDate(i.getDate() + 1)) {
				// var dateSearch = new Date(i.getUTCFullYear(), i.getUTCMonth(), i.getUTCDate());
				var dateSearch = i;
				var daterecords = $.grep(entries, function (element, index) {
					return that.oFormatyyyymmdd.format(element.CaleDate) == that.oFormatyyyymmdd.format(dateSearch) && element.Status !== '99';
				});
				if (daterecords.length === 0) {
					continue;
				}
				var recordTemplate = {
					AllowEdit: "",
					AllowRelease: "",
					AssignmentId: "",
					AssignmentName: "",
					CatsDocNo: "",
					Counter: "",
					Pernr: this.empID,
					RefCounter: "",
					RejReason: "",
					Status: "",
					SetDraft: false,
					HeaderData: {
						target: daterecords[0].TargetHours,
						sum: "0.00",
						date: new Date(i),
						addButton: false,
						highlight: false
					},
					target: daterecords[0].TargetHours,
					TimeEntryDataFields: {
						AENAM: "",
						ALLDF: "",
						APDAT: null,
						APNAM: "",
						ARBID: "00000000",
						ARBPL: "",
						AUERU: "",
						AUFKZ: "",
						AUTYP: "00",
						AWART: "",
						BEGUZ: "000000",
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
						ENDUZ: "000000",
						ERNAM: "",
						ERSDA: "",
						ERSTM: "",
						ERUZU: "",
						EXTAPPLICATION: "",
						EXTDOCUMENTNO: "",
						EXTSYSTEM: "",
						FUNC_AREA: "",
						FUND: "",
						GRANT_NBR: "",
						HRBUDGET_PD: "",
						HRCOSTASG: "0",
						HRFUNC_AREA: "",
						HRFUND: "",
						HRGRANT_NBR: "",
						HRKOSTL: "",
						HRLSTAR: "",
						KAPAR: "",
						KAPID: "00000000",
						KOKRS: "",
						LAEDA: "",
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
						PAOBJNR: "0000000000",
						PEDD: null,
						PERNR: "00000000",
						PLANS: "00000000",
						POSID: "",
						PRAKN: "",
						PRAKZ: "0000",
						PRICE: "0.0",
						RAPLZL: "00000000",
						RAUFNR: "",
						RAUFPL: "0000000000",
						REASON: "",
						REFCOUNTER: "000000000000",
						REINR: "0000000000",
						RKDAUF: "",
						RKDPOS: "000000",
						RKOSTL: "",
						RKSTR: "",
						RNPLNR: "",
						RPROJ: "00000000",
						RPRZNR: "",
						SBUDGET_PD: "",
						SEBELN: "",
						SEBELP: "00000",
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
						WORKDATE: new Date(i),
						WORKITEMID: "000000000000",
						WTART: ""
					},
					TimeEntryOperation: ""
				};
				if (daterecords[0].TimeEntries.results.length > 1) {
					daterecords[0].TimeEntries.results = daterecords[0].TimeEntries.results.sort(function (obj1, obj2) {
						if (obj1.Status === '99') {
							return -1;
						} else if (obj2.Status === '99') {
							return 1;
						}
					});
				}
				var sumHours = 0;
				for (var j = 0; j < daterecords[0].TimeEntries.results.length; j++) {

					daterecords[0].TimeEntries.results[j].target = daterecords[0].TargetHours;
					daterecords[0].TimeEntries.results[j].TimeEntryDataFields.CATSHOURS = parseFloat(daterecords[0].TimeEntries.results[j].TimeEntryDataFields
						.CATSHOURS).toFixed(2);
					if (daterecords[0].TimeEntries.results[j].TimeEntryDataFields.CATSHOURS === "0.00" && daterecords[0].TimeEntries.results[j].TimeEntryDataFields
						.CATSQUANTITY !== "") {
						daterecords[0].TimeEntries.results[j].TimeEntryDataFields.CATSHOURS = parseFloat(daterecords[0].TimeEntries.results[j].TimeEntryDataFields
							.CATSQUANTITY).toFixed(2);
					}
					daterecords[0].TimeEntries.results[j].TimeEntryDataFields.CATSQUANTITY = parseFloat(daterecords[0].TimeEntries.results[j].TimeEntryDataFields
						.CATSQUANTITY).toFixed(3);
					if (daterecords[0].TimeEntries.results[j].TimeEntryDataFields
						.STATUS !== '40') {
						sumHours = parseFloat(sumHours) + parseFloat(daterecords[0].TimeEntries.results[j].TimeEntryDataFields
							.CATSHOURS);
					}
					timedata.push(daterecords[0].TimeEntries.results[j]);

				}
				for (var j = 0; j < daterecords[0].TimeEntries.results.length; j++) {
					daterecords[0].TimeEntries.results[j].totalHours = sumHours.toFixed(2);
					if ((j + 1) === daterecords[0].TimeEntries.results.length) {
						daterecords[0].TimeEntries.results[j].addButton = true;
						daterecords[0].TimeEntries.results[j].addButtonEnable = true;
						daterecords[0].TimeEntries.results[j].deleteButton = true;
						daterecords[0].TimeEntries.results[j].deleteButtonEnable = true;
						daterecords[0].TimeEntries.results[j].SetDraft = false;
						var recDate = new Date(i);
						recDate.setHours(0, 0, 0, 0);
						daterecords[0].TimeEntries.results[j].HeaderData = {
							target: daterecords[0].TargetHours,
							sum: sumHours.toFixed(2) + "",
							date: recDate,
							addButton: true,
							highlight: false
						};
					} else {
						daterecords[0].TimeEntries.results[j].addButton = false;
						daterecords[0].TimeEntries.results[j].addButtonEnable = false;
						daterecords[0].TimeEntries.results[j].deleteButton = true;
						daterecords[0].TimeEntries.results[j].deleteButtonEnable = true;
						daterecords[0].TimeEntries.results[j].SetDraft = false;
						var recDate = new Date(i);
						recDate.setHours(0, 0, 0, 0);
						daterecords[0].TimeEntries.results[j].HeaderData = {
							target: daterecords[0].TargetHours,
							sum: sumHours.toFixed(2) + "",
							date: recDate,
							addButton: false,
							highlight: false
						};
					}
				}
				var newLineNotNeededFlag = "";
				if (daterecords[0].TimeEntries.results.length === 0 || daterecords[0].TimeEntries.results[0].Status === '99') {
					for (var l = 0; l < daterecords[0].TimeEntries.results.length; l++) {
						if (daterecords[0].TimeEntries.results[l].Status !== '99') {
							newLineNotNeededFlag = "X";
						}
					}
					if (newLineNotNeededFlag !== "X") {
						recordTemplate.totalHours = sumHours.toFixed(2);
						recordTemplate.addButton = true;
						recordTemplate.HeaderData.addButton = true;
						recordTemplate.addButtonEnable = false;
						recordTemplate.deleteButtonEnable = false;
						recordTemplate.SetDraft = false;
						if (daterecords[0].TimeEntries.results.length > 0) //In case of status 99
							recordTemplate.HeaderData.sum = daterecords[0].TimeEntries.results[0].HeaderData.sum;
						timedata.push(recordTemplate);
					}
				}

			}
			for (var i = 0; i < timedata.length; i++) {
				if (timedata[i].TimeEntryDataFields.STATUS === "10") {
					timedata[i].SetDraft = true;
				}
				var element = $.grep(statusdata, function (element, index) {
					if (timedata[i].TimeEntryDataFields.STATUS && timedata[i].TimeEntryDataFields.STATUS != "")
						return element.key === timedata[i].TimeEntryDataFields.STATUS;
				});
				if (element && element.length > 0) {
					continue;
				}
				timedata[i].highlight = "None";
				timedata[i].valueState = "None";
			}
			//assignment overview display screen sort start
			var sortKey = that.sortKey;
			if (sortKey && sortKey !== "NoSelection") {
				var sortdata = timedata.sort(function (element1, element2) {
					if (new Date(element1.HeaderData.date).getMonth() === new Date(element2.HeaderData.date).getMonth() && new Date(element1.HeaderData
							.date).getDay() === new Date(element2.HeaderData.date).getDay() && new Date(element1.HeaderData.date).getYear() === new Date(
							element2.HeaderData.date).getYear()) {
						if (sortKey === "StartTime") {
							if (parseInt(element1.TimeEntryDataFields.BEGUZ) < parseInt((element2.TimeEntryDataFields.BEGUZ))) {
								if (!that.sortDecendingOrder) {
									return -1;
								} else {
									return 1;
								}
							}
							if (parseInt(element1.TimeEntryDataFields.BEGUZ) > parseInt((element2.TimeEntryDataFields.BEGUZ))) {
								if (!that.sortDecendingOrder) {
									return 1;
								} else {
									return -1;
								}
							}
						} else if (sortKey === "Assignment") {
							if (element1.AssignmentName.toLowerCase() < element2.AssignmentName.toLowerCase()) {
								if (!that.sortDecendingOrder) {
									return -1;
								} else {
									return 1;
								}
							}
							if (!that.sortDecendingOrder) {
								return 1;
							} else {
								return -1;
							}
						} else if (sortKey === "EndTime") {
							if (parseInt(element1.TimeEntryDataFields.ENDUZ) < parseInt((element2.TimeEntryDataFields.ENDUZ))) {
								if (!that.sortDecendingOrder) {
									return -1;
								} else {
									return 1;
								}
							}
							if (parseInt(element1.TimeEntryDataFields.ENDUZ) > parseInt((element2.TimeEntryDataFields.ENDUZ))) {
								if (!that.sortDecendingOrder) {
									return 1;
								} else {
									return -1;
								}
							}
						}

					}
				});
				sortdata = sortdata.sort(function (element1, element2) {
					if (new Date(element1.HeaderData.date).getMonth() === new Date(element2.HeaderData.date).getMonth() && new Date(element1.HeaderData
							.date).getDay() === new Date(element2.HeaderData.date).getDay() && new Date(element1.HeaderData.date).getYear() === new Date(
							element2.HeaderData.date).getYear()) {
						if (element1.Status === "99" && element2.Status !== "99") {
							return -1;
						} else if (element2.Status === "99" && element1.Status !== "99") {
							return 1;
						}
					}
				});

				var index = null;
				for (index = 0; index < (sortdata.length - 1); index++) {
					if (sortdata[index].HeaderData.date.getYear() === sortdata[index + 1].HeaderData.date.getYear() && sortdata[index].HeaderData.date
						.getMonth() === sortdata[index + 1].HeaderData.date.getMonth() && sortdata[index].HeaderData.date.getDate() === sortdata[index +
							1].HeaderData.date.getDate()) {
						if (sortdata[index].HeaderData.addButton === true && sortdata[index].addButton === true) {
							sortdata[index].HeaderData.addButton = false;
							sortdata[index].addButton = false;
							sortdata[index].addButtonEnable = false;
							sortdata[index + 1].HeaderData.addButton = true;
							sortdata[index + 1].addButton = true;
							sortdata[index + 1].addButtonEnable = true;
						}
					}
				}
				oModel.setData(sortdata);
			} else {
				oModel.setData(timedata);
			}
			//assignment overview display screen sort end
			oModel.attachPropertyChange(this.onOverviewDataChanged.bind(this));
			this.setModel(oModel, "TimeData");
			this.setModel(new JSONModel(statusdata), "Status");
			this.oTable.setBusy(false);
		},

		onOverviewDataChanged: function () {
			var that = this;
			var oControl = this.getModel("controls");
			oControl.setProperty('/overviewDataChanged', true);
		},
		getFirstDayOfWeek: function (date, from) {
			//Default start week from 'Sunday'. You can change it yourself.
			var index = from;
			var start = index >= 0 ? index : 0;
			var d = new Date(date);
			var day = d.getDay();
			var diff = d.getDate() - day + (start > day ? start - 7 : start);
			d.setDate(diff);
			return d;
		},
		getLastDayOfWeek: function (date, from) {
			var index = from;
			var start = index >= 0 ? index : 0;
			var d = new Date(date);
			var day = d.getDay();
			var diff = d.getDate() - day + (start > day ? start - 1 : 6 + start);
			d.setDate(diff);
			return d;
		},
		onCheckLocking: function () {
			var that = this;
			var employeeID = this.empID;
			var getLengthPernr = employeeID.toString().length;
			//Taking dummy 8 length string
			var dummyString = "00000000";

			//Appending zero in start to make it 8 length
			var pernr = dummyString.substring(0, dummyString.length - getLengthPernr) + employeeID.toString();

			var oGlobalModel = this.getGlobalModel();
			var mParameters = {
				success: function (oData) {
					if (oData.Islocked === 'X') {
						sap.m.MessageBox.error(oData.ErrMsg, {
							title: "Error",
							actions: sap.m.MessageBox.Action.Close,
							initialFocus: null,
							textDirection: sap.ui.core.TextDirection.Inherit
						});
					} else {
						that.onEdit();
					}
				},

				error: function () {}
			};

			oGlobalModel.read(that.appendLocaleParameter("/LockingCheckSet(Pernr=\'" + pernr + "\')"), mParameters);
		},
		onToDoCheckLocking: function () {
			var that = this;
			var employeeID = this.empID;
			var getLengthPernr = employeeID.toString().length;
			//Taking dummy 8 length string
			var dummyString = "00000000";

			//Appending zero in start to make it 8 length
			var pernr = dummyString.substring(0, dummyString.length - getLengthPernr) + employeeID.toString();

			var oGlobalModel = this.getGlobalModel();
			var mParameters = {
				success: function (oData) {
					if (oData.Islocked === 'X') {
						sap.m.MessageBox.error(oData.ErrMsg, {
							title: "Error",
							actions: sap.m.MessageBox.Action.Close,
							initialFocus: null,
							textDirection: sap.ui.core.TextDirection.Inherit
						});
					} else {
						that.onToDoEdit();
					}
				},

				error: function () {}
			};

			oGlobalModel.read(that.appendLocaleParameter("/LockingCheckSet(Pernr=\'" + pernr + "\')"), mParameters);
		},
		onEdit: function () {
			var oModel = this.getModel('controls');
			oModel.setProperty('/showFooter', true);
			oModel.setProperty('/sendForApproval', true);
			oModel.setProperty('/sendForApprovalCheck', this.checkButtonNeeded === "X" ? true : false);
			oModel.setProperty('/submitDraft', this.profileInfo.AllowRelease === "TRUE" ? false : true);
			oModel.setProperty('/overviewCancel', true);
			oModel.setProperty('/todoCancel', false);
			oModel.setProperty('/duplicateVisibility', true);
			oModel.setProperty("/duplicateScreen", false);
			if (sap.ui.Device.system.phone === false && this.dailyView !== "X") {
				oModel.setProperty('/duplicateWeekVisibility', true);
			}
			oModel.setProperty('/overviewEdit', false);
			oModel.setProperty('/todoDone', false);
			oModel.setProperty('/todoDoneCheck', false);
			// oModel.setProperty('/onEdit', "MultiSelect");
			oModel.setProperty('/onEdit', "None");
			oModel.setProperty('/duplicateTaskEnable', false);

			this.readTemplate = new sap.m.ColumnListItem({
				cells: [
					new sap.m.Text({
						text: "{path: 'TimeData>TimeEntryDataFields/WORKDATE', type: 'sap.ui.model.type.Date', formatOptions: { pattern: 'EEEE, MMMM d' }}"
					}),
					new sap.m.ObjectIdentifier({
						text: "{TimeData>TimeEntryDataFields/AWART}"
					}),
					// new sap.m.ObjectIdentifier({
					// 	text: "{TimeData>TimeEntryDataFields/CATSHOURS} / {TimeData>target}",
					// 	state: {
					// 		parts: [{
					// 			path: 'TimeData>TimeEntryDataFields/CATSHOURS'
					// 		}, {
					// 			path: 'TimeData>target'
					// 		}],
					// 		formatter: formatter.hoursValidation
					// 	}
					// }),
					new sap.m.ObjectStatus({
						text: {
							path: 'TimeData>TimeEntryDataFields/STATUS',
							formatter: formatter.status
						},
						state: {
							path: 'TimeData>TimeEntryDataFields/STATUS',
							formatter: formatter.state
						}
					}),
					new sap.m.ObjectStatus({
						icon: "sap-icon://notes",
						visible: {
							parts: [{
								path: 'TimeData>TimeEntryDataFields/LONGTEXT'
							}, {
								path: 'TimeData>RejReasondesc'
							}],
							formatter: formatter.visibility
						}
					})
				]
			});
			// this.
			this.getView().byId("idOverviewTable").removeItem(0);
			var that = this;

			// this.getView().byId("idOverviewTable").setMode("MultiSelect");
			this.oEditableTemplate = new sap.m.ColumnListItem({
				highlight: "{TimeData>highlight}",
				cells: [
					// new sap.ui.layout.VerticalLayout({content:[					
					// 	new sap.m.Text({
					// 	text: "{path: 'TimeData>TimeEntryDataFields/WORKDATE', type: 'sap.ui.model.type.Date', formatOptions: { pattern: 'EEEE, MMMM d' }}"
					// }),
					// new sap.m.ObjectStatus({
					// 	text: {
					// 		parts: [{
					// 			path: 'TimeData>totalHours'
					// 		}, {
					// 			path: 'TimeData>target'
					// 		}],
					// 		formatter: formatter.concatStrings
					// 	},
					// 	state: {
					// 		parts: [{
					// 			path: 'TimeData>totalHours'
					// 		}, {
					// 			path: 'TimeData>target'
					// 		}],
					// 		formatter: formatter.hoursValidation
					// 	}
					// }),
					// ]}),
					// new sap.m.Text({
					// 	text: "{path: 'TimeData>TimeEntryDataFields/WORKDATE', type: 'sap.ui.model.type.Date', formatOptions: { pattern: 'EEE, MMM d' }}"
					// }),
					// new sap.m.ObjectStatus({
					// 	text: {
					// 		parts: [{
					// 			path: 'TimeData>totalHours'
					// 		}, {
					// 			path: 'TimeData>target'
					// 		}],
					// 		formatter: formatter.concatStrings
					// 	},
					// 	state: {
					// 		parts: [{
					// 			path: 'TimeData>totalHours'
					// 		}, {
					// 			path: 'TimeData>target'
					// 		}],
					// 		formatter: formatter.hoursValidation
					// 	}
					// }),
					// new sap.m.ComboBox({
					// 	selectedKey: "{TimeData>AssignmentId}",
					// 	selectionChange: this.onSelectionChange
					// }).bindItems({
					// 	path: "Tasks>/",
					// 	// factory: this.activeTasks,
					// 	template: new sap.ui.core.Item({
					// 		key: "{Tasks>AssignmentId}",
					// 		text: "{Tasks>AssignmentName}",
					// 		enabled: {
					// 			path: 'Tasks>AssignmentStatus',
					// 			formatter: this.formatter.activeTasks
					// 		}
					// 	}),
					// 	templateShareable: true
					// }),
					new sap.m.ObjectStatus({
						text: {
							parts: [{
								path: 'TimeData>totalHours',
								type: 'sap.ui.model.odata.type.Decimal',
								formatOptions: {
									parseAsString: true,
									decimals: 2,
									maxFractionDigits: 2,
									minFractionDigits: 0
								},
								constraints: {
									precision: 4,
									scale: 2,
									minimum: '0',
									maximum: '10000'
								}
							}, {
								path: 'TimeData>target',
								type: 'sap.ui.model.odata.type.Decimal',
								formatOptions: {
									parseAsString: true,
									decimals: 2,
									maxFractionDigits: 2,
									minFractionDigits: 0
								},
								constraints: {
									precision: 4,
									scale: 2,
									minimum: '0',
									maximum: '10000'
								}
							}],
							formatter: formatter.concatStrings
						},
						visible: true
					}),
					new sap.m.ComboBox({
						selectedKey: "{TimeData>AssignmentId}",
						selectionChange: this.onSelectionChange.bind(this),
						placeholder: {
							parts: [{
								path: 'TimeData>Status'
							}, {
								path: 'TimeData>AssignmentName'
							}, {
								path: 'TimeData>target'
							}, {
								path: 'TimeData>AssignmentId'
							}, {
								path: 'textBundle>/ApprovedLeave'
							}, {
								path: 'textBundle>/assignmentSelection'
							}, {
								path: 'textBundle>/noAssignment'
							}],
							formatter: this.formatter.getPlaceHolder
						},
						tooltip: {
							path: 'TimeData>AssignmentId',
							formatter: this.formatter.getTooltip.bind(this)
						},
						enabled: {
							path: 'TimeData>Status',
							formatter: this.formatter.checkHrRecord.bind(this)
						},
						showSecondaryValues: true
					}).bindItems({
						path: "TasksWithGroups>/",
						// sorter: new sap.ui.model.Sorter("AssignmentName", false, false, function (sVal1, sVal2) {
						// 	if (sVal1 > sVal2) {
						// 		return 1;
						// 	}
						// 	return -1;
						// }),
						// factory: this.activeTasks,
						template: new sap.ui.core.ListItem({
							key: "{TasksWithGroups>AssignmentId}",
							text: "{TasksWithGroups>AssignmentName}",
							enabled: {
								parts: [{
									path: 'TasksWithGroups>AssignmentStatus'
								}, {
									path: 'TasksWithGroups>ValidityStartDate'
								}, {
									path: 'TasksWithGroups>ValidityEndDate'
								}, {
									path: 'TimeData>TimeEntryDataFields'
								}],
								formatter: this.formatter.activeTasks
							},
							additionalText: "{TasksWithGroups>AssignmentType}"
						}),
						templateShareable: true
					}).addEventDelegate({
						onfocusin: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', false);
							}
						},
						onfocusout: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', true);
							}
						}
					}),
					new sap.m.Button({
						icon: "sap-icon://edit-outside",
						type: "Transparent",
						tooltip: this.formEntryName,
						press: this.loadAdHocFragment.bind(this),
						visible: this.getModel('controls').getProperty('/isFormEntryEnabled')
					}),
					new sap.m.Button({
						icon: "sap-icon://message-information",
						type: sap.m.ButtonType.Transparent,
						press: this.onAssignmentQuickView.bind(this),
						// visible: "{TimeData>addButton}",
						enabled: {
							parts: [{
								path: 'TimeData>AssignmentId'
							}, {
								path: 'TimeData>Counter'
							}],
							formatter: this.formatter.infoEnabled
						},
						visible: true
					}),

					// new sap.ui.layout.VerticalLayout({
					// content: [
					new sap.ui.layout.HorizontalLayout({
						content: [
							new sap.m.StepInput({
								value: {
									parts: [{
										path: 'TimeData>TimeEntryDataFields/CATSHOURS'
									}, {
										path: 'TimeData>TimeEntryDataFields/CATSQUANTITY'
									}, {
										path: 'TimeData>TimeEntryDataFields/CATSAMOUNT'
									}],
									formatter: formatter.calHoursQuanAmountInput.bind(this)
								},
								description: {
									parts: [{
										path: 'TimeData>TimeEntryDataFields/UNIT'
									}, {
										path: 'TimeData>TimeEntryDataFields/CATSHOURS'
									}],
									formatter: formatter.getUnitTexts.bind(this)
								},
								change: this.liveChangeHours.bind(this),
								displayValuePrecision: 2,
								validationMode: "LiveChange",
								step: 1,
								tooltip: "",
								min: 0,
								fieldWidth: "60%",
								valueState: "{TimeData>valueState}",
								valueStateText: "{TimeData>valueStateText}",
								enabled: {
									parts: [{
										path: 'TimeData>Status'
									}, {
										path: 'controls>/hoursDisabled'
									}],
									formatter: this.formatter.checkHrRecord.bind(this)
								}
							}).addEventDelegate({
								validation: function (oEvent) {
									try {
										if (parseFloat(oEvent.srcControl.getValue()) >= 0.0) {
											//	this.byId("OverviewCheckButton").setVisible(true);
											that.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);

										}
									} catch (exception) {

									}
								},
								onfocusin: function (oEvent) {
									if (sap.ui.Device.system.phone == true) {
										that.getModel('controls').setProperty('/showFooter', false);
									}
								},
								onfocusout: function (oEvent) {
									if (sap.ui.Device.system.phone == true) {
										that.getModel('controls').setProperty('/showFooter', true);
									}
								},
								onsapup: function (oEvent) {
									this.validation(oEvent);
								},
								onkeyup: function (oEvent) {
									try {
										if (parseFloat(oEvent.srcControl.getValue()) > 0.0) {
											that.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
											//	this.byId("OverviewCheckButton").setVisible(true);

										}
									} catch (exception) {

									}
								},
								onsapdown: function (oEvent) {
									this.validation(oEvent);
								}

							})
						]
					}),
					new sap.m.CheckBox({
						selected: "{TimeData>SetDraft}",
						visible: this.draftStatus,
						enabled: {
							path: 'TimeData>Status',
							formatter: this.formatter.checkHrRecord.bind(this)
						}
					}).attachSelect(this.onSelectionDraft.bind(this)),
					// new sap.m.Button({
					// 	icon: "sap-icon://activity-items",
					// 	type: sap.m.ButtonType.Transparent,
					// 	press: this.onReadOnlyProjectDetails.bind(this),
					// 	visible: {
					// 		parts: [{
					// 			path: 'TimeData>TimeEntryDataFields/CPR_GUID'
					// 		}, {
					// 			path: 'TimeData>TimeEntryDataFields/CPR_OBJGUID'
					// 		}],
					// 		formatter: this.formatter.projectsVisible.bind(this)
					// 	}
					// }),
					new sap.m.TimePicker({
						value: {
							parts: [{
									path: 'TimeData>TimeEntryDataFields/BEGUZ'
								}, {
									path: 'TimeData>TimeEntryDataFields/ENDUZ'
								}

							],

							formatter: this.formatter.formatTableTimeStart.bind(this)
						},
						visible: this.clockTimeVisible,
						valueFormat: "HH:mm",
						displayFormat: sap.ui.core.format.DateFormat.getTimeInstance({
							style: "short"
						}).oFormatOptions.pattern,
						change: this.startTimeChange.bind(this),
						placeholder: this.oBundle.getText("startTime"),
						enabled: {
							path: 'TimeData>Status',
							formatter: this.formatter.checkHrRecord.bind(this)
						}
					}).addEventDelegate({
						onfocusin: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', false);
							}
						},
						onfocusout: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', true);
							}
						}
					}),
					new sap.m.TimePicker({
						value: {
							parts: [{
									path: 'TimeData>TimeEntryDataFields/BEGUZ'
								}, {
									path: 'TimeData>TimeEntryDataFields/ENDUZ'
								}

							],

							formatter: this.formatter.formatTableTimeEnd.bind(this)
						},
						visible: this.clockTimeVisible,
						valueFormat: "HH:mm",
						displayFormat: sap.ui.core.format.DateFormat.getTimeInstance({
							style: "short"
						}).oFormatOptions.pattern,
						change: this.endTimeChange.bind(this),
						placeholder: this.oBundle.getText("endTime"),
						enabled: {
							path: 'TimeData>Status',
							formatter: this.formatter.checkHrRecord.bind(this)
						}
					}).addEventDelegate({
						onfocusin: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', false);
							}
						},
						onfocusout: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', true);
							}
						}
					}),
					new sap.m.CheckBox({
						selected: {
							path: 'TimeData>TimeEntryDataFields/VTKEN',
							formatter: formatter.checkPrevDay
						},
						visible: this.previousDayIndicator,
						editable: this.previousDayIndicatorEdit,
						enabled: {
							path: 'TimeData>Status',
							formatter: this.formatter.checkHrRecord.bind(this)
						}
					}).attachSelect(this.onPreviousDayIndicator.bind(this)),
					new sap.m.ObjectStatus({
						text: {
							path: 'TimeData>TimeEntryDataFields/STATUS',
							formatter: formatter.status
						},
						state: {
							path: 'TimeData>TimeEntryDataFields/STATUS',
							formatter: formatter.state
						}
					}),
					new sap.m.Button({
						icon: {
							path: 'TimeData>TimeEntryDataFields/LONGTEXT',
							formatter: formatter.longtextButtons
						},
						tooltip: this.getModel("i18n").getResourceBundle().getText('comment'),
						type: sap.m.ButtonType.Transparent,
						press: this.longtextPopover.bind(this),
						enabled: {
							path: 'TimeData>Status',
							formatter: this.formatter.checkHrRecord.bind(this)
						}
					}),
					new sap.m.Text({
						text: {
							parts: [{
								path: 'TimeData>TimeEntryDataFields'
							}, {
								path: 'OverviewAttributes>/state'
							}],
							formatter: formatter.ConcatenateText.bind(this)
						}
					}),
					new sap.ui.layout.HorizontalLayout({
						content: [
							// new sap.m.Button({
							// 	icon: {
							// 		path: 'TimeData>TimeEntryDataFields/LONGTEXT',
							// 		formatter: formatter.longtextButtons
							// 	},
							// 	type: sap.m.ButtonType.Transparent,
							// 	press: this.longtextPopover.bind(this),
							// 	tooltip: this.getModel("i18n").getResourceBundle().getText('comment'),
							// 	enabled: {
							// 		path: 'TimeData>Status',
							// 		formatter: this.formatter.checkHrRecord.bind(this)
							// 	}
							// }),
							new sap.m.Button({
								icon: "sap-icon://sys-cancel",
								type: sap.m.ButtonType.Transparent,
								press: this.onOverviewDeleteRow.bind(this),
								tooltip: this.getModel("i18n").getResourceBundle().getText('deleteRow'),
								visible: "{TimeData>deleteButton}",
								enabled: "{TimeData>deleteButtonEnable}"
							}),
							new sap.m.Button({
								icon: "sap-icon://add",
								type: sap.m.ButtonType.Transparent,
								press: this.onOverviewAddRow.bind(this),
								visible: "{TimeData>addButton}",
								enabled: "{TimeData>addButtonEnable}"
							})
						],
						visible: {
							path: 'TimeData>Status',
							formatter: this.formatter.checkHrRecord.bind(this)
						}
					})

				],
				customData: [new sap.ui.core.CustomData({
					key: "counter",
					value: "{TimeData>Counter}"
				})]
			});
			/**
			 * @ControllerHook Modify or add columns to the Overview table in edit mode
			 * This hook method can be used to modify the object before binding
			 * It is called when the decision options for the detail item are fetched successfully
			 * @callback hcm.mytimesheet.view.S3~extHookOnEditOverview
			 * @param {object} Post Object
			 * @return {object} Final Post Object
			 */
			if (this.extHookOnEditOverview) {
				this.oEditableTemplate = this.extHookOnEditOverview(this.oEditableTemplate);
			}
			// this.rebindTable(this.oEditableTemplate, "Edit");
			this.rebindTableWithTemplate(this.oTable, "TimeData>/", this.oEditableTemplate, "Edit");
			this.getEnteredHours(false);

		},
		onSave: function () {

		},
		deleteAdHocDays: function (oEvent) {
			var that = this;
			var oControl = this.getModel('controls');
			//var index = oEvent.getParameters().listItem.getBindingContext('selectedDatesDup').getPath().split('/selectedDates/')[1];
			var data = this.getModel('adHocTotalTarget').getData();
			if (data.length === 1) {
				oControl.setProperty("/duplicateScreen", false);
				return;
			}
			if (data.length === 2) {
				oControl.setProperty("/duplicateScreen", false);
			}
			var adHocDates = [];
			// this.byId("duplicateCalendar").removeSelectedDate(new sap.ui.unified.DateRange({startDate:data.selectedDates[index].Date}));
			// this.byId("mDuplicateCalendar").removeSelectedDate(new sap.ui.unified.DateRange({startDate:data.selectedDates[index].Date}));
			this.byId("idCalendar").removeAllSelectedDates();
			this.byId("mCalendar").removeAllSelectedDates();

			//Fetching the date from the calendar which needs to be removed
			for (var i = 0; i < that.adHocSelectedDates.length; i++) {
				if (new Date(that.adHocSelectedDates[i].getStartDate()).getTime() === new Date(oEvent.getSource().getCustomData()[0].getValue()).getTime() &&
					i !== 0) {
					that.adHocSelectedDates.splice(i, 1);
					i--;
					continue;
				} //Selecting the dates back and setting the model
				else {

					adHocDates.push(new Date(that.adHocSelectedDates[i].getStartDate()));

					this.byId("idCalendar").addSelectedDate(
						new sap.ui.unified.DateRange({
							startDate: new Date(that.adHocSelectedDates[i].getStartDate())

						})

					);

					this.byId("mCalendar").addSelectedDate(
						new sap.ui.unified.DateRange({
							startDate: new Date(that.adHocSelectedDates[i].getStartDate())

						})
					);

				}
			}
			this.getModel("adHocCopyDates").setData(adHocDates);
			this.getModel("adHocCopyDates").refresh();

			var finalAdHocDates = {};
			for (var i = 0; i < adHocDates.length; i++) {
				var newDate = new Date(adHocDates[i]);
				newDate.setHours(0, 0, 0, 0);
				finalAdHocDates[newDate.getTime()] = 1;

			}
			var oData = this.getModel('adHocTotalTarget').getData();

			for (var i = 1; i < oData.length; i++) {
				var date = new Date(oData[i].date);
				date.setHours(0, 0, 0, 0);
				if (!finalAdHocDates[date.getTime()]) {
					oData.splice(i, 1);
					i--;
				}

			}
			this.getModel('adHocTotalTarget').refresh();
			oControl.setProperty("/duplicateScreen", true);
			if (adHocDates.length) {
				this.getModel("controls").setProperty("/singleAdHocDay", false);
				this.getModel("controls").setProperty("/currentDate", that.formEntryName);
			} else {
				this.getModel("controls").setProperty("/singleAdHocDay", true);
				this.getModel("controls").setProperty("/currentDate", that.formEntryName);
			}

		},
		loadAdHocEntries: function (oEvent) {
			//Loading adHoc Entries from get Profile fields
			var profileFieldsData = this.getModel("AdHocModel").getData();
			var formElements = [];
			var formContainers = [];
			var oModel = new JSONModel();
			var form = {
				name: null,
				status: false,
				containers: null,
				entryFields: true
			};

			var adHocData = $.extend(true, [], profileFieldsData);

			for (var i = 0; i < adHocData.length; i++) {
				if (adHocData[i].FieldName !== "AssignmentName" && adHocData[i].FieldName !== "ValidityStartDate" && adHocData[i].FieldName !==
					"ValidityEndDate") {
					formElements.push(adHocData[i]);
				}
				if (formElements.length >= 1) {
					formContainers.push({
						form: $.extend(formElements, [], true)
					});
					formElements = [];
				}
			}

			form.containers = formContainers;
			var oField = {
				fields: [],
				name: null,
				status: false

			};

			oModel.setData(form);

			this.createGroupingOfFields(formContainers, oField);
			this.setGlobalModel(new JSONModel(oField), "AdHocModel");
			this.getModel("AdHocModel").refresh();

		},
		setCheckbox: function (oEvent) {
			//Getting the binding context and setting the value
			//If field is VTKEN special handling
			if (oEvent.getSource().getCustomData()[0].getValue().FieldName === "VTKEN") {
				if (oEvent.getSource().getSelected()) {
					oEvent.getSource().getCustomData()[0].getValue().FieldValue = "X";
				} else {
					oEvent.getSource().getCustomData()[0].getValue().FieldValue = "";
				}
			} else {
				oEvent.getSource().getCustomData()[0].getValue().FieldValue = oEvent.getSource().getSelected();
			}
			this.enableSubmit();
		},
		enableSubmit: function () {
			this.successfulCheck = "";
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isOverviewChanged", false);
				this.getModel("controls").setProperty("/overviewDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isOverviewChanged", true);
				this.getModel("controls").setProperty("/overviewDataChanged", true);
			}

		},
		getCustomData: function (oEvent) {
			var that = this;
			var captureSource = oEvent.getSource();
			var index = oEvent.getSource().getCustomData()[0].getValue();
			var oData = this.getModel("adHocAdditionHelp").getData();
			var helpData = null;
			if (index === "") {

				this.getModel("adHocAdditionalHelp").setData(oData[oData.length - 1]);
				if (this.getModel("adHocAdditionalHelp").getData().GroupName === "") {
					this.getModel("adHocAdditionalHelp").setProperty("/GroupName", this.getModel("i18n").getResourceBundle().getText(
						'defaultFieldGroupName'));

				}

			} else {
				this.getModel("adHocAdditionalHelp").setData(oData[parseInt(index)]);
				if (this.getModel("adHocAdditionalHelp").getData().GroupName === "") {
					this.getModel("adHocAdditionalHelp").setProperty("/GroupName", this.getModel("i18n").getResourceBundle().getText(
						'defaultFieldGroupName'));
				}

			}

			var noGroupElements = $.grep(this.getModel("adHocAdditionalHelp").getData().groupHelp, function (value) {

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
						this.elementIndex = parseInt(event.getParameter("srcControl").getBindingContext("adHocAdditionalHelp").getPath().split(
							"/groupHelp/")[
							1]);
						//Index position inside the block

						oDialog.attachAfterClose(function () {
							var focusElement = false;
							var element = that.dialogSource.getParent().getParent().getAggregation("content")[0].getAggregation("formContainers")[
								that.elementIndex].getAggregation('formElements')[0].getFields()[0];

							element.getItems().forEach(function (value) {
								if (value.getVisible() === true && !focusElement && value.focus()) {
									focusElement = true;
									jQuery.sap.delayedCall(200, this, function () {
										try {
											value.focus();
										} catch (e) {

										}
									});
								} else {
									return;
								}
							});
							if (element.getItems()[0].getVisible() === true) //All input field case
							{
								// element.getItems()[0].setValueState(sap.ui.core.ValueState.Success);
								// element.getItems()[0].setValueStateText("Item Selected from additional help");
								jQuery.sap.delayedCall(200, this, function () {

									element.getItems()[0].focus();
								});
							} else //Additional handling in case of date picker Finish forecast date
							{
								// element.getItems()[2].setValueState(sap.ui.core.ValueState.Success);
								// element.getItems()[2].setValueStateText("Item Selected from additional help");

								jQuery.sap.delayedCall(200, this, function () {

									element.getItems()[2].focus();
								});

							}
						});
						oDialog.close();

					}
				};
				if (!oDialog) {
					oDialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.adHocAdditionalHelpFragment",
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
		},
		openAssignmentFragment: function (oEvent) {
			var that = this;
			var oDialog;
			if (that.oAssignmentDialog) {
				that.oAssignmentDialog.destroy();
				that.oAssignmentDialog = null;
			}
			var oDialogController = {
				handleClose: function (event) {
					that.getView().byId("saveAssignment").destroy();
					that.oAssignmentDialog.close();
				},
				validateDatePicker: function (event) {

					if (that.getModel("adHocSaveAssignmentModel").getData().assignmentName && that.getModel('adHocSaveAssignmentModel').getData()
						.validFrom &&
						that.getModel(
							'adHocSaveAssignmentModel').getData().validTo) {
						that.getView().byId("saveAssignment").setEnabled(true);
					} else {
						that.getView().byId("saveAssignment").setEnabled(false);
					}
				},
				validateInput: function (event) {

					if (event.getSource().getValue() && that.getModel('adHocSaveAssignmentModel').getData()
						.validFrom &&
						that.getModel(
							'adHocSaveAssignmentModel').getData().validTo) {
						that.getView().byId("saveAssignment").setEnabled(true);
					} else {
						that.getView().byId("saveAssignment").setEnabled(false);
					}

				},

				saveAdHocAssignment: function () {
					that.onSaveAdHocAssignment();
				},

			};

			//Checking for the required fields
			var required = false;
			var oContainer = this.getGlobalModel("AdHocModel").getData().fields;
			var oMessages = [];

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
					});
				});
			});
			this.getGlobalModel("AdHocModel").refresh();
			if (required === true) {

				oMessages.push(new sap.ui.core.message.Message({
					message: that.oBundle.getText("requiredField"),
					type: sap.ui.core.MessageType.Error,
					processor: this.getOwnerComponent().oMessageProcessor
				}));

				if (oMessages.length > 0) {
					var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
					sap.m.MessageBox.error(
						that.oBundle.getText("requiredField"), {
							actions: [sap.m.MessageBox.Action.CANCEL],
							styleClass: bCompact ? "sapUiSizeCompact" : "",

						});
					return;
				}
			} else {

				if (!that.oAssignmentDialog) {
					that.oAssignmentDialog = sap.ui.xmlfragment(that.getView().getId(), "hcm.fab.mytimesheet.view.fragments.ImportAdHocAssignment",
						oDialogController);
					that.getView().addDependent(that.oAssignmentDialog);

					that.oAssignmentDialog.attachBeforeOpen(function () {
						if (that.getModel("adHocSaveAssignmentModel").getData().assignmentName && that.getModel('adHocSaveAssignmentModel').getData()
							.validFrom &&
							that.getModel(
								'adHocSaveAssignmentModel').getData().validTo) {
							that.getView().byId("saveAssignment").setEnabled(true);
						} else {
							that.getView().byId("saveAssignment").setEnabled(false);
						}
					});

					// oDialog.bindElement('TimeData>' + oEvent.getSource().getBindingContext('TimeData').getPath());
				}

				// delay because addDependent will do a async rerendering and the popover will immediately close without it
				var oButton = oEvent.getSource();
				jQuery.sap.delayedCall(0, this, function () {
					that.oAssignmentDialog.open(oButton);
				});
			}
		},
		loadAdHocFragment: function (oEvent) {

			//	this.loadAdHocEntries(oEvent);
			var oLayout = this.getView().byId('overviewLayout');
			var oContainer = this.getModel("AdHocModel").getData().fields;
			var oModel = this.getModel("AdHocModel");
			var startTimeActive = false; //Check whether start time and end time are active
			var startTimeInitial = false; //Will be used for formatting
			var endTimeInitial = false; //Will be used for formatting
			oContainer.forEach(function (element) {
				element.containers.forEach(function (element1) {
					element1.form.forEach(function (subElement) {
						delete subElement.valueState;
						delete subElement.valueStateText;
					});
				});
			});
			var oTimeData = this.getModel('TimeData');
			var dataIndex = parseInt(oEvent.getSource().getParent().getBindingContext("TimeData").getPath().split("/")[1]);
			//Setting the inital entries for cancel adhoc scenarios
			var oldEntry = $.extend(true, {}, oTimeData.getData()[dataIndex]);
			this.setModel(new JSONModel(oldEntry), 'oldEntry');

			//Getting the counter using the custom data
			var counter = oTimeData.getData()[dataIndex].Counter;
			this.adHocLongTextDataReference = null;

			this.getModel('controls').setProperty('/adHocCounter', counter);

			this.getModel('controls').setProperty('/index', dataIndex);
			this.getModel('controls').setProperty('/currentDate', this.formEntryName);
			var data = this.getModel('TimeData').getData();
			data[dataIndex].AssignmentName = this.formEntryName;
			data[dataIndex].AssignmentId = "111";
			//	var newData = $.extend(true, {}, data[dataIndex]);
			//Model is set for new Time Date and this can be used for modification
			//	this.setModel(new JSONModel(newData), 'AdHocTimeData');

			//	if(data[index].TimeEntryOper)

			//Loading the entries into the corresponding fields
			for (var index = 0; index < oContainer.length; index++) {
				for (var index1 = 0; index1 < oContainer[index].containers.length; index1++) {
					for (var index2 = 0; index2 < oContainer[index].containers[index1].form.length; index2++) {

						if (oContainer[index].containers[index1].form[index2].dummy === "true") {
							continue;
						} else if (oContainer[index].containers[index1].form[index2].FieldName === "LONGTEXT_DATA") {
							//Storing the reference in case of long text data
							this.adHocLongTextDataReference = oContainer[index].containers[index1].form[index2];
							oContainer[index].containers[index1].form[index2].FieldValue = data[dataIndex].TimeEntryDataFields[oContainer[index].containers[
								index1].form[index2].FieldName];

						} else if (oContainer[index].containers[index1].form[index2].FieldName === "DRAFT") {
							if (data[dataIndex].SetDraft == true) {
								oContainer[index].containers[index1].form[index2].FieldValue = true;
								this.getModel("controls").setProperty("/adHocDraftSelected", true);

							} else {
								oContainer[index].containers[index1].form[index2].FieldValue = false;
								this.getModel("controls").setProperty("/adHocDraftSelected", false);

							}
						} else if (oContainer[index].containers[index1].form[index2].FieldName === "BEGUZ") {
							startTimeActive = true;

							if (data[dataIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2].FieldName] === '000000') {
								startTimeInitial = true;
								//Storing the reference of startTime from container
								this.startTimeRef = oContainer[index].containers[index1].form[index2];

							}
							oContainer[index].containers[index1].form[index2].FieldValue = data[dataIndex].TimeEntryDataFields[oContainer[index].containers[
								index1].form[index2].FieldName];
						} else if (oContainer[index].containers[index1].form[index2].FieldName === "ENDUZ") {
							startTimeActive = true;

							if (data[dataIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2].FieldName] === '000000') {
								endTimeInitial = true;
								this.endTimeRef = oContainer[index].containers[index1].form[index2];

							}
							oContainer[index].containers[index1].form[index2].FieldValue = data[dataIndex].TimeEntryDataFields[oContainer[index].containers[
								index1].form[index2].FieldName];
						} else if (oContainer[index].containers[index1].form[index2].FieldName === "CATSHOURS") {
							oContainer[index].containers[index1].form[index2].FieldValue = parseFloat(data[dataIndex].TimeEntryDataFields[oContainer[index]
								.containers[
									index1].form[index2].FieldName]);
						} else {
							if (oContainer[index].containers[index1].form[index2].FieldName === 'VTKEN') {
								if (data[dataIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2].FieldName] === 'X') {
									this.getModel("controls").setProperty("/adHocPreviousDaySelected", true);
								} else {
									this.getModel("controls").setProperty("/adHocPreviousDaySelected", false);

								}
							}

							oContainer[index].containers[index1].form[index2].FieldValue = data[dataIndex].TimeEntryDataFields[oContainer[index].containers[
								index1].form[index2].FieldName];
						}
					}

				}
			}

			//Checking for initial start and end in case with clock is active from CAC1
			if (startTimeActive) {
				if (endTimeInitial && startTimeInitial) {
					this.startTimeRef.FieldValue = '';
					this.endTimeRef.FieldValue = '';
				}
			}

			//Storing first month of the calendar to focus back after adhoc
			this.firstMonthOfCalendar = this.calendar.getStartDate().getMonth();
			//Checking for the startdate month
			this.startDateMonth = this.startdate.getMonth();

			if (this.firstMonthOfCalendar > this.startDateMonth) {
				this.isLastWeek = true;
			} else {
				this.isLastWeek = false;
			}

			//Firing the single day calendar selection
			this.adHocStartDate = new Date(data[dataIndex].TimeEntryDataFields.WORKDATE);
			this.calendarSelection(this.calendar,
				this.adHocStartDate);
			this.calendarSelection(this.mCalendar, this.adHocStartDate);
			var selectedDate = new Date(data[dataIndex].TimeEntryDataFields.WORKDATE);
			selectedDate.setHours(0, 0, 0, 0);
			var newDate = new Date(selectedDate);
			newDate.setHours(0, 0, 0, 0);
			this.adHocSelectedDates = [selectedDate];
			this.setModel(new JSONModel([{
				date: newDate,
				recorded: data[dataIndex].totalHours,
				target: data[dataIndex].target,
				updated: 0.00
			}]), 'adHocTotalTarget');

			//Setting highlight true for that record
			data[dataIndex].highlight = sap.ui.core.MessageType.Information;
			data[dataIndex].HeaderData.highlight = true;

			this.getModel('controls').setProperty('/target', data[dataIndex].HeaderData.target);
			this.getModel('controls').setProperty('/recorded', data[dataIndex].HeaderData.sum);
			this.setModel(new JSONModel({
				assignmentName: "",
				validFrom: null,
				validTo: null,
				status: true,
				withClock: false

			}), "adHocSaveAssignmentModel");
			this.getModel('controls').setProperty("/duplicateScreen", false);
			if (counter && counter !== null) {
				data[dataIndex].TimeEntryOperation = 'U';
				this.getModel('controls').setProperty('/adHocUpdate', true);
				this.getModel('controls').setProperty('/adHocCreate', false);
			} else {
				data[dataIndex].TimeEntryOperation = 'C';
				this.getModel('controls').setProperty('/adHocUpdate', false);
				this.getModel('controls').setProperty('/adHocCreate', true);
			}

			oModel.refresh();
			this.getModel('controls').setProperty('/currentAdHoc', true);
			this.getModel('controls').setProperty('/singleSelection', false);
			this.getModel('controls').setProperty('/intervalSelection', false);
			this.setModel(new JSONModel([new Date(oTimeData.getData()[dataIndex].HeaderData.date)]), "adHocCopyDates");
			this.getModel("controls").setProperty("/singleAdHocDay", false);
			if (!this.getModel("controls").getProperty('/isOlderMultipleDays')) {
				this.getModel('controls').setProperty("/duplicateScreen", false);
			} else {
				this.getModel('controls').setProperty("/duplicateScreen", true);
			}
			this.adHocDemandEntries = {};
			try {
				this.byId('adHocDetailsTable').getItems()[0].getCells()[2].setVisible(false); //Clearing the close button
			} catch (e) {

			}

		},

		loadAdHocTodoFragment: function (oEvent) {

			var that = this;
			var oContainer = this.getModel("AdHocModel").getData().fields;
			var oModel = this.getModel("AdHocModel");
			var startTimeActive = false; //Check whether start time and end time are active
			var startTimeInitial = false; //Will be used for formatting
			var endTimeInitial = false; //Will be used for formatting
			this.adHocLongTextDataReference = null;
			oContainer.forEach(function (element) {
				element.containers.forEach(function (element1) {
					element1.form.forEach(function (subElement) {
						delete subElement.valueState;
						delete subElement.valueStateText;
					});
				});
			});

			var oTodoTimeData = this.getModel('TodoList');
			var dataIndex = parseInt(oEvent.getSource().getParent().getBindingContext("TodoList").getPath().split("/")[1]);
			//Setting the inital entries for cancel adhoc scenarios
			var oldEntry = $.extend(true, {}, oTodoTimeData.getData()[dataIndex]);
			this.setModel(new JSONModel(oldEntry), 'oldEntryTodo');

			//Getting the counter using the custom data
			var counter = oTodoTimeData.getData()[dataIndex].Counter;

			this.getModel('controls').setProperty('/adHocCounter', counter);

			this.getModel('controls').setProperty('/index', dataIndex);
			this.getModel('controls').setProperty('/currentDate', that.formEntryName);
			var data = this.getModel('TodoList').getData();
			data[dataIndex].AssignmentName = that.formEntryName;
			data[dataIndex].AssignmentId = "111";
			//	var newData = $.extend(true, {}, data[dataIndex]);
			//Model is set for new Time Date and this can be used for modification
			//	this.setModel(new JSONModel(newData), 'AdHocTimeData');

			//	if(data[index].TimeEntryOper)

			//Loading the entries into the corresponding fields
			for (var index = 0; index < oContainer.length; index++) {
				for (var index1 = 0; index1 < oContainer[index].containers.length; index1++) {
					for (var index2 = 0; index2 < oContainer[index].containers[index1].form.length; index2++) {

						if (oContainer[index].containers[index1].form[index2].dummy === "true") {
							continue;
						} else if (oContainer[index].containers[index1].form[index2].FieldName === "LONGTEXT_DATA") {
							//Storing the reference in case of long text data
							this.adHocLongTextDataReference = oContainer[index].containers[index1].form[index2];
							oContainer[index].containers[index1].form[index2].FieldValue = data[dataIndex].TimeEntryDataFields[oContainer[index].containers[
								index1].form[index2].FieldName];

						} else if (oContainer[index].containers[index1].form[index2].FieldName === "DRAFT") {
							if (data[dataIndex].SetDraft == true) {
								oContainer[index].containers[index1].form[index2].FieldValue = true;
								this.getModel("controls").setProperty("/adHocTodoDraftSelected", true);

							} else {
								oContainer[index].containers[index1].form[index2].FieldValue = false;
								this.getModel("controls").setProperty("/adHocTodoDraftSelected", false);

							}

						} else if (oContainer[index].containers[index1].form[index2].FieldName === "BEGUZ") {
							startTimeActive = true;

							if (data[dataIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2].FieldName] === '000000') {
								startTimeInitial = true;
								//Storing the reference of startTime from container
								this.startTimeRef = oContainer[index].containers[index1].form[index2];

							}
							oContainer[index].containers[index1].form[index2].FieldValue = data[dataIndex].TimeEntryDataFields[oContainer[index].containers[
								index1].form[index2].FieldName];
						} else if (oContainer[index].containers[index1].form[index2].FieldName === "ENDUZ") {
							startTimeActive = true;

							if (data[dataIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2].FieldName] === '000000') {
								endTimeInitial = true;
								this.endTimeRef = oContainer[index].containers[index1].form[index2];

							}
							oContainer[index].containers[index1].form[index2].FieldValue = data[dataIndex].TimeEntryDataFields[oContainer[index].containers[
								index1].form[index2].FieldName];
						} else if (oContainer[index].containers[index1].form[index2].FieldName === "CATSHOURS") {
							oContainer[index].containers[index1].form[index2].FieldValue = parseFloat(data[dataIndex].TimeEntryDataFields[oContainer[index]
								.containers[
									index1].form[index2].FieldName]);
						} else {
							if (oContainer[index].containers[index1].form[index2].FieldName === 'VTKEN') {
								if (data[dataIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2].FieldName] === 'X') {
									this.getModel("controls").setProperty("/adHocTodoPreviousDaySelected", true);
								} else {
									this.getModel("controls").setProperty("/adHocTodoPreviousDaySelected", false);

								}
							}
							oContainer[index].containers[index1].form[index2].FieldValue = data[dataIndex].TimeEntryDataFields[oContainer[index].containers[
								index1].form[index2].FieldName];
						}
					}

				}
			}
			//Checking for initial start and end in case with clock is active from CAC1
			if (startTimeActive) {
				if (endTimeInitial && startTimeInitial) {
					this.startTimeRef.FieldValue = '';
					this.endTimeRef.FieldValue = '';
				}
			}

			//Firing the single day calendar selection
			this.adHocTodoStartDate = new Date(data[dataIndex].TimeEntryDataFields.WORKDATE);
			var selectedDate = new Date(data[dataIndex].TimeEntryDataFields.WORKDATE);
			selectedDate.setHours(0, 0, 0, 0);
			var newDate = new Date(selectedDate);
			newDate.setHours(0, 0, 0, 0);
			this.adHocSelectedDates = [selectedDate];
			this.setModel(new JSONModel([{
				date: newDate,
				recorded: data[dataIndex].total,
				target: data[dataIndex].target,
				updated: 0.00
			}]), 'adHocTodoTotalTarget');

			//Setting highlight true for that record
			data[dataIndex].highlight = sap.ui.core.MessageType.Information;

			this.setModel(new JSONModel({
				assignmentName: "",
				validFrom: null,
				validTo: null,
				status: true,
				withClock: false

			}), "adHocSaveAssignmentModel");
			if (counter && counter !== null) {
				data[dataIndex].TimeEntryOperation = 'U';
				this.getModel('controls').setProperty('/adHocTodoUpdate', true);
				this.getModel('controls').setProperty('/adHocTodoCreate', false);
			} else {
				data[dataIndex].TimeEntryOperation = 'C';
				this.getModel('controls').setProperty('/adHocTodoUpdate', false);
				this.getModel('controls').setProperty('/adHocTodoCreate', true);
			}

			oModel.refresh();
			var finalSum = 0.0;

			//Now we will fetch all the entries and add the recorded target sum will be modified accordingly
			this.getTimeEntriesOnDemand(new Date(that.adHocTodoStartDate)).then(function (result) {

				var results = result[0].TimeEntries.results;

				for (var i = 0; i < results.length; i++) {
					if (results[i].TimeEntryDataFields.STATUS == '10' || results[i].TimeEntryDataFields.STATUS == '40') {
						continue;
					}
					finalSum = finalSum + parseFloat(results[i].TimeEntryDataFields.CATSHOURS);
					finalSum.toFixed(2);
				}
				var currentSelectedDate = new Date(that.adHocTodoStartDate);
				currentSelectedDate.setHours(0, 0, 0, 0);
				//Date will come from timeData
				var timeDataEntry = $.grep(that.getModel('TodoList').getData(), function (value) {
					var date = new Date(value.TimeEntryDataFields.WORKDATE);
					date.setHours(0, 0, 0, 0);
					if (date.getTime() === currentSelectedDate.getTime()) {
						return true;
					}
					return false;
				});

				for (var i = 0; i < timeDataEntry.length; i++) {

					finalSum = finalSum + parseFloat(timeDataEntry[i].TimeEntryDataFields.CATSHOURS);
					finalSum.toFixed(2);
				}
				that.setModel(new JSONModel([{
					date: currentSelectedDate,
					recorded: finalSum,
					target: data[dataIndex].target,
					updated: 0.00
				}]), 'adHocTodoTotalTarget');
				that.getModel('controls').setProperty('/currentTodoAdHoc', true);

			});

			this.adHocDemandEntries = {};

		},
		onTodoAdHocSumbitConfirm: function (oEvent) {
			var that = this;
			var oContainer = this.getModel("AdHocModel").getData().fields;
			var timeData = this.getModel('TodoList').getData();
			var timeIndex = this.getModel('controls').getProperty("/index");

			//Now checking for update or submit of records
			if (that.getModel("controls").getProperty("/adHocTodoUpdate") === true) {
				//Getting the recorded entry
				for (var index = 0; index < oContainer.length; index++) {
					for (var index1 = 0; index1 < oContainer[index].containers.length; index1++) {
						for (var index2 = 0; index2 < oContainer[index].containers[index1].form.length; index2++) {

							if (oContainer[index].containers[index1].form[index2].dummy === "true") {
								continue;
							} else {
								//checking for draft
								if (oContainer[index].containers[index1].form[index2]['FieldName'] === 'DRAFT') {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === true) //Means a draft entry
									{
										timeData[timeIndex]['SetDraft'] = true;

									} else {
										timeData[timeIndex]['SetDraft'] = false;
									}
								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "VTKEN") {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === "X") {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
											index].containers[
											index1].form[index2]['FieldValue'];
									} else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = "";
									}
								}
								//checking for Long Text
								else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "LONGTEXT_DATA") {
									if (oContainer[index].containers[index1].form[index2]['FieldValue']) {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
											index].containers[
											index1].form[index2]['FieldValue'];
										timeData[timeIndex].TimeEntryDataFields["LONGTEXT"] = 'X';
									}
								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "BEGUZ" || oContainer[index].containers[index1]
									.form[
										index2]['FieldName'] === "ENDUZ") {

									// if (parseInt(oContainer[index].containers[index1].form[index2]['FieldValue'])) {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === '') {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = this.formatter.convertAssignmentTime(
											'000000');
									}
									// if (parseInt(oContainer[index].containers[index1].form[index2]['FieldValue'])) {
									else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = this.formatter.convertAssignmentTime(
											oContainer[index].containers[index1].form[index2]['FieldValue']);
									}

									// }

								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "POSID") {
									if (!oContainer[index].containers[index1].form[index2]['FieldValue']) {
										timeData[timeIndex].TimeEntryDataFields["RPROJ"] = "00000000";
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
												index]
											.containers[
												index1].form[index2]['FieldValue'];
									} else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
												index]
											.containers[
												index1].form[index2]['FieldValue'];
									}
								} else {

									timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[index]
										.containers[
											index1].form[index2]['FieldValue'];
								}

								//Now updating the timeData index 
								timeData[timeIndex].TimeEntryDataFields.CATSHOURS = parseFloat(timeData[timeIndex].TimeEntryDataFields.CATSHOURS).toFixed(2);
								timeData[timeIndex].TimeEntryDataFields.WORKDATE = new Date(that.adHocTodoStartDate);
								timeData[timeIndex].TimeEntryOperation = "U";
								//Now making the entry model to be submitted

							}

						}
					}

				}
			} else {
				for (var index = 0; index < oContainer.length; index++) {
					for (var index1 = 0; index1 < oContainer[index].containers.length; index1++) {
						for (var index2 = 0; index2 < oContainer[index].containers[index1].form.length; index2++) {

							if (oContainer[index].containers[index1].form[index2].dummy === "true") {
								continue;
							} else {
								//checking for draft
								if (oContainer[index].containers[index1].form[index2]['FieldName'] === 'DRAFT') {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === true) //Means a draft entry
									{
										timeData[timeIndex]['SetDraft'] = true;

									} else {
										timeData[timeIndex]['SetDraft'] = false;
									}
								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "BEGUZ" || oContainer[index].containers[index1]
									.form[
										index2]['FieldName'] === "ENDUZ") {

									// if (parseInt(oContainer[index].containers[index1].form[index2]['FieldValue'])) {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === '') {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = this.formatter.convertAssignmentTime(
											'000000');
									}
									// if (parseInt(oContainer[index].containers[index1].form[index2]['FieldValue'])) {
									else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = this.formatter.convertAssignmentTime(
											oContainer[index].containers[index1].form[index2]['FieldValue']);
									}

									// }

								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "VTKEN") {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === "X") {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
											index].containers[
											index1].form[index2]['FieldValue'];
									} else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = "";
									}
								}

								//checking for Long Text
								else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "LONGTEXT_DATA") {
									if (oContainer[index].containers[index1].form[index2]['FieldValue']) {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
											index].containers[
											index1].form[index2]['FieldValue'];
										timeData[timeIndex].TimeEntryDataFields["LONGTEXT"] = 'X';
									}
								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "POSID") {
									if (!oContainer[index].containers[index1].form[index2]['FieldValue']) {
										timeData[timeIndex].TimeEntryDataFields["RPROJ"] = "00000000";
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
												index]
											.containers[
												index1].form[index2]['FieldValue'];
									} else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
												index]
											.containers[
												index1].form[index2]['FieldValue'];
									}
								} else {

									timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[index]
										.containers[
											index1].form[index2]['FieldValue'];
								}

								//Now updating the timeData index 
								timeData[timeIndex].TimeEntryDataFields.CATSHOURS = parseFloat(timeData[timeIndex].TimeEntryDataFields.CATSHOURS).toFixed(2);
								timeData[timeIndex].TimeEntryDataFields.WORKDATE = new Date(that.adHocTodoStartDate);
								timeData[timeIndex].TimeEntryOperation = "C";

							}
						}
					}
				}

			}
			timeData[timeIndex].deleteButtonEnable = true;
			timeData[timeIndex].addButtonEnable = true;
			this.getModel('TodoList').refresh();
			this.onTodoAdHocCopy();
		},

		onAdHocSubmitConfirm: function (oEvent) {

			var that = this;
			var oContainer = this.getModel("AdHocModel").getData().fields;
			var timeData = this.getModel('TimeData').getData();
			var timeIndex = this.getModel('controls').getProperty("/index");

			//Now checking for update or submit of records
			if (that.getModel("controls").getProperty("/adHocUpdate") === true) {
				//Getting the recorded entry
				for (var index = 0; index < oContainer.length; index++) {
					for (var index1 = 0; index1 < oContainer[index].containers.length; index1++) {
						for (var index2 = 0; index2 < oContainer[index].containers[index1].form.length; index2++) {

							if (oContainer[index].containers[index1].form[index2].dummy === "true") {
								continue;
							} else {
								//checking for draft
								if (oContainer[index].containers[index1].form[index2]['FieldName'] === 'DRAFT') {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === true) //Means a draft entry
									{
										timeData[timeIndex]['SetDraft'] = true;

									} else {
										timeData[timeIndex]['SetDraft'] = false;
									}
								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "VTKEN") {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === "X") {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
											index].containers[
											index1].form[index2]['FieldValue'];
									} else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = "";
									}
								}

								//checking for Long Text
								else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "LONGTEXT_DATA") {
									if (oContainer[index].containers[index1].form[index2]['FieldValue']) {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
											index].containers[
											index1].form[index2]['FieldValue'];
										timeData[timeIndex].TimeEntryDataFields["LONGTEXT"] = 'X';
									}
								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "BEGUZ" || oContainer[index].containers[index1]
									.form[
										index2]['FieldName'] === "ENDUZ") {

									// if (parseInt(oContainer[index].containers[index1].form[index2]['FieldValue'])) {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === '') {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = this.formatter.convertAssignmentTime(
											'000000');
									}
									// if (parseInt(oContainer[index].containers[index1].form[index2]['FieldValue'])) {
									else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = this.formatter.convertAssignmentTime(
											oContainer[index].containers[index1].form[index2]['FieldValue']);
									}

									// }

								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "POSID") {
									if (!oContainer[index].containers[index1].form[index2]['FieldValue']) {
										timeData[timeIndex].TimeEntryDataFields["RPROJ"] = "00000000";
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
												index]
											.containers[
												index1].form[index2]['FieldValue'];
									} else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
												index]
											.containers[
												index1].form[index2]['FieldValue'];
									}
								} else {

									timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[index]
										.containers[
											index1].form[index2]['FieldValue'];
								}

								//Now updating the timeData index 
								timeData[timeIndex].TimeEntryDataFields.CATSHOURS = parseFloat(timeData[timeIndex].TimeEntryDataFields.CATSHOURS).toFixed(2);
								timeData[timeIndex].TimeEntryDataFields.WORKDATE = new Date(that.adHocStartDate);
								timeData[timeIndex].TimeEntryOperation = "U";
								//Now making the entry model to be submitted

							}

						}
					}

				}
			} else {
				for (var index = 0; index < oContainer.length; index++) {
					for (var index1 = 0; index1 < oContainer[index].containers.length; index1++) {
						for (var index2 = 0; index2 < oContainer[index].containers[index1].form.length; index2++) {

							if (oContainer[index].containers[index1].form[index2].dummy === "true") {
								continue;
							} else {
								//checking for draft
								if (oContainer[index].containers[index1].form[index2]['FieldName'] === 'DRAFT') {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === true) //Means a draft entry
									{
										timeData[timeIndex]['SetDraft'] = true;

									} else {
										timeData[timeIndex]['SetDraft'] = false;
									}
								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "BEGUZ" || oContainer[index].containers[index1]
									.form[
										index2]['FieldName'] === "ENDUZ") {

									// if (parseInt(oContainer[index].containers[index1].form[index2]['FieldValue'])) {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === '') {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = this.formatter.convertAssignmentTime(
											'000000');
									}
									// if (parseInt(oContainer[index].containers[index1].form[index2]['FieldValue'])) {
									else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = this.formatter.convertAssignmentTime(
											oContainer[index].containers[index1].form[index2]['FieldValue']);
									}

									// }

								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "VTKEN") {
									if (oContainer[index].containers[index1].form[index2]['FieldValue'] === "X") {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
											index].containers[
											index1].form[index2]['FieldValue'];
									} else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = "";
									}
								}

								//checking for Long Text
								else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "LONGTEXT_DATA") {
									if (oContainer[index].containers[index1].form[index2]['FieldValue']) {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
											index].containers[
											index1].form[index2]['FieldValue'];
										timeData[timeIndex].TimeEntryDataFields["LONGTEXT"] = 'X';
									}
								} else if (oContainer[index].containers[index1].form[index2]['FieldName'] == "POSID") {
									if (!oContainer[index].containers[index1].form[index2]['FieldValue']) {
										timeData[timeIndex].TimeEntryDataFields["RPROJ"] = "00000000";
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
												index]
											.containers[
												index1].form[index2]['FieldValue'];
									} else {
										timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[
												index]
											.containers[
												index1].form[index2]['FieldValue'];
									}
								} else {

									timeData[timeIndex].TimeEntryDataFields[oContainer[index].containers[index1].form[index2]['FieldName']] = oContainer[index]
										.containers[
											index1].form[index2]['FieldValue'];
								}

								//Now updating the timeData index 
								timeData[timeIndex].TimeEntryDataFields.CATSHOURS = parseFloat(timeData[timeIndex].TimeEntryDataFields.CATSHOURS).toFixed(2);
								timeData[timeIndex].TimeEntryDataFields.WORKDATE = new Date(that.adHocStartDate);
								timeData[timeIndex].TimeEntryOperation = "C";

							}
						}
					}
				}

			}
			var finalData = new Array(0);
			var mainData = $.extend(true, {}, timeData[timeIndex]);
			var mainDate = new Date(this.adHocStartDate);

			finalData.push({
				date: mainDate,
				data: mainData,
				recoreded: mainData.HeaderData.sum,
				target: mainData.HeaderData.target

			});

			this.setModel(new JSONModel(finalData), "adHocCreateCopy");
			//Fetching final entries
			this.onAdHocCopy();
			var finalEntries = new Array(0);
			var oData = this.getModel('adHocCreateCopy').getData();
			oData.forEach(function (value, index) {
				finalEntries.push($.extend(true, {}, value.data));
			});
			this.setModel(new JSONModel(finalEntries), 'finalAdHocData');
			timeData[timeIndex].deleteButtonEnable = true;
			timeData[timeIndex].addButtonEnable = true;
			this.getModel('TimeData').refresh();

		},
		clearSelectedEntry: function () {
			var recordTemplate = this.recordTemplate();
			var timeData = this.getModel('TimeData').getData();
			var timeIndex = this.getModel('controls').getProperty("/index");
			//Clearing the selected entry
			timeData[timeIndex].TimeEntryDataFields = $.extend(true, {}, recordTemplate.TimeEntryDataFields);

		},
		clearSelectedTodoEntry: function () {
			var recordTemplate = this.recordTemplate();
			var timeData = this.getModel('TodoList').getData();
			var timeIndex = this.getModel('controls').getProperty("/index");
			//Clearing the selected entry
			timeData[timeIndex].TimeEntryDataFields = $.extend(true, {}, recordTemplate.TimeEntryDataFields);
		},
		onPressCancelButtonAdHoc: function () {

			var that = this;
			var oControl = this.getModel('controls');
			var dataIndex = oControl.getProperty('/index');
			this.getModel('TimeData').getData()[dataIndex].AssignmentName = "";
			this.getModel('TimeData').getData()[dataIndex].AssignmentId = "";
			this.getModel('TimeData').refresh();

			this.getModel('TimeData').getData()[dataIndex] = this.getModel('oldEntry').getData();
			this.calculateSum(new Date(this.adHocStartDate), this.getModel('TimeData').getData());

			this.getModel('TimeData').refresh();
			if (oControl.getProperty('/currentAdHoc')) {
				//Replacing data with old value
				this.getModel('TimeData').getData()[oControl.getProperty('/index')] = this.getModel('oldEntry').getData();
				try {
					if (sap.ui.Device.system.phone == true) {
						// this.mCalendar.setStartDate(new Date(this.startdate));
					} else {
						var firstMonth = this.firstMonthOfCalendar;
						if (this.isLastWeek) {
							var now = new Date(this.startdate);
							if (now.getMonth() == 11) {
								var current = new Date(now.getFullYear() + 1, 0, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() > that.maxFocusDate.getTime()) {
									this.calendar.focusDate(that.maxFocusDate);
								} else {
									this.calendar.focusDate(current);
								}
							} else {
								var current = new Date(now.getFullYear(), now.getMonth() + 1, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() > that.maxFocusDate.getTime()) {
									this.calendar.focusDate(that.maxFocusDate);
								} else {
									this.calendar.focusDate(current);
								}
							}

						} else {
							this.calendar.focusDate(this.startdate);

						}
						if (this.firstMonthOfCalendar === (this.calendar.getStartDate().getMonth() + 1) % 12) {
							var now = new Date(this.startdate);
							if (now.getMonth() == 11) {
								var current = new Date(now.getFullYear() + 1, 0, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() > that.maxFocusDate.getTime()) {
									this.calendar.focusDate(that.minFocusDate);
								} else {
									this.calendar.focusDate(current);
								}
							} else {
								var current = new Date(now.getFullYear(), now.getMonth() + 1, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() > that.maxFocusDate.getTime()) {
									this.calendar.focusDate(that.minFocusDate);
								} else {
									this.calendar.focusDate(current);
								}
							}
						} else if ((this.firstMonthOfCalendar + 1) % 12 === (this.calendar.getStartDate().getMonth())) {
							var now = new Date(this.startdate);
							if (now.getMonth() == 0) {
								var current = new Date(now.getFullYear() - 1, 12, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() < that.minFocusDate.getTime()) {
									this.calendar.focusDate(that.minFocusDate);
								} else {
									this.calendar.focusDate(current);
								}

							} else {
								var current = new Date(now.getFullYear(), now.getMonth() - 1, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() < that.minFocusDate.getTime()) {
									this.calendar.focusDate(that.minFocusDate);
								} else {
									this.calendar.focusDate(current);
								}
							}
						}

					}
				} catch (e) {

				}

			}
			oControl.setProperty("/intervalSelection", false);
			oControl.setProperty("/singleSelection", true);
			oControl.setProperty("/currentAdHoc", false);
			oControl.setProperty("/adHocUpdate", false);
			oControl.setProperty('/adHocCreate', false);

			this.setModel(new JSONModel({
				assignmentName: "",
				validFrom: null,
				validTo: null,
				status: true,
				withClock: false

			}), "adHocSaveAssignmentModel");
			this.getModel("adHocSaveAssignmentModel").refresh();
			that.adHocSelectedDates = null;
			oControl.setProperty('/index', -1);
			oControl.setProperty('/recorded', 0);
			oControl.setProperty('/target', 0);
			that.setModel(new JSONModel([]), "adHocCreateCopy");
			if (!oControl.getProperty('/isOlderMultipleDays')) //Inside multiple days adhoc entry or nested multiple single days adhoc entry
			{

				try {
					this.calendarSelection(this.calendar, new Date(this.startdate), new Date(this.enddate));
					this.calendarSelection(this.mCalendar, new Date(this.startdate), new Date(this.enddate));
					oControl.setProperty("/duplicateScreen", false);
				} catch (e) {

				}
			} else //Single Day adHoc Entry  
			{
				if (sap.ui.Device.system.phone == true) {
					// this.mCalendar.setStartDate(new Date(this.startdate));
					this.mCalendar.destroySelectedDates();
				} else {
					this.calendar.destroySelectedDates();
				}
			}

			//Getting entered hours for progress indicator
			if (this.getModel('controls').getProperty('/duplicateScreen') === false) {
				this.getEnteredHours(true);
			}

		},
		onPressCancelButtonAdHocTodo: function () {
			var that = this;
			var oControl = this.getModel('controls');
			var oTodoData = this.getModel('TodoList').getData();
			var dataIndex = oControl.getProperty('/index');
			this.getModel('TodoList').getData()[dataIndex].AssignmentName = "";
			this.getModel('TodoList').getData()[dataIndex].AssignmentId = "";

			this.getModel('TodoList').refresh();
			this.getModel('TodoList').getData()[dataIndex] = this.getModel('oldEntryTodo').getData();

			for (var i = 0; i < oTodoData.length; i++) {
				var date = new Date(oTodoData[i].TimeEntryDataFields.WORKDATE);
				date.setHours(0, 0, 0, 0);
				var dateComp = new Date(this.adHocTodoStartDate);
				dateComp.setHours(0, 0, 0, 0);

				if (date.getTime() === dateComp.getTime()) {
					oTodoData[i].total = this.getModel('TodoList').getData()[dataIndex].total;
				}
			}
			this.getModel('TodoList').refresh();
			this.resetTodoAdHocControls();
			this.setModel(new JSONModel({
				assignmentName: "",
				validFrom: null,
				validTo: null,
				status: true,
				withClock: false

			}), "adHocSaveAssignmentModel");
			this.getModel("adHocSaveAssignmentModel").refresh();

		},

		onTodoAdHocOkPress: function () {
			var required = false;
			var that = this;
			//Checking for required fields
			var oContainer = this.getGlobalModel("AdHocModel").getData().fields;
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

					});
				});
			});

			this.getModel("AdHocModel").refresh();

			if (required === true) {

				var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
				sap.m.MessageBox.error(
					that.oBundle.getText("requiredField"), {
						actions: [sap.m.MessageBox.Action.CANCEL],
						styleClass: bCompact ? "sapUiSizeCompact" : "",

					});

				return;
			}
			oContainer.forEach(function (element) {
				element.containers.forEach(function (element1) {
					element1.form.forEach(function (subElement) {
						delete subElement.valueState;
						delete subElement.valueStateText;
					});
				});
			});
			this.onTodoAdHocSumbitConfirm();
			this.successfulCheck = "";

		},
		onAdHocOkPress: function () {
			var that = this;

			var required = false;
			//Checking for required fields
			var oContainer = this.getGlobalModel("AdHocModel").getData().fields;
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

					});
				});
			});

			this.getModel("AdHocModel").refresh();

			if (required === true) {

				var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
				sap.m.MessageBox.error(
					that.oBundle.getText("requiredField"), {
						actions: [sap.m.MessageBox.Action.CANCEL],
						styleClass: bCompact ? "sapUiSizeCompact" : "",

					});

				return;
			}
			oContainer.forEach(function (element) {
				element.containers.forEach(function (element1) {
					element1.form.forEach(function (subElement) {
						delete subElement.valueState;
						delete subElement.valueStateText;
					});
				});
			});

			this.onAdHocSubmitConfirm();
			this.successfulCheck = "";
			try {
				if (sap.ui.Device.system.phone == true) {
					// this.mCalendar.setStartDate(new Date(this.startdate));
				} else {
					if (this.isLastWeek) {
						var now = new Date(this.startdate);
						if (now.getMonth() == 11) {
							var current = new Date(now.getFullYear() + 1, 0, 1);
							current.setHours(0, 0, 0, 0);
							if (current.getTime() > that.maxFocusDate.getTime()) {
								this.calendar.focusDate(that.maxFocusDate);
							} else {
								this.calendar.focusDate(current);
							}
						} else {
							var current = new Date(now.getFullYear(), now.getMonth() + 1, 1);
							current.setHours(0, 0, 0, 0);
							if (current.getTime() > that.maxFocusDate.getTime()) {
								this.calendar.focusDate(that.maxFocusDate);
							} else {
								this.calendar.focusDate(current);
							}
						}

					} else {
						this.calendar.focusDate(this.startdate);

					}
					if (this.firstMonthOfCalendar === (this.calendar.getStartDate().getMonth() + 1) % 12) {
						var now = new Date(this.startdate);
						if (now.getMonth() == 11) {
							var current = new Date(now.getFullYear() + 1, 0, 1);
							current.setHours(0, 0, 0, 0);
							if (current.getTime() > that.maxFocusDate.getTime()) {
								this.calendar.focusDate(that.maxFocusDate);
							} else {
								this.calendar.focusDate(current);
							}
						} else {
							var current = new Date(now.getFullYear(), now.getMonth() + 1, 1);
							current.setHours(0, 0, 0, 0);
							if (current.getTime() > that.maxFocusDate.getTime()) {
								this.calendar.focusDate(that.maxFocusDate);
							} else {
								this.calendar.focusDate(current);
							}
						}
					} else if ((this.firstMonthOfCalendar + 1) % 12 === (this.calendar.getStartDate().getMonth())) {
						var now = new Date(this.startdate);
						if (now.getMonth() == 0) {
							var current = new Date(now.getFullYear() - 1, 12, 1);
							current.setHours(0, 0, 0, 0);
							if (current.getTime() < that.minFocusDate.getTime()) {
								this.calendar.focusDate(that.minFocusDate);
							} else {
								this.calendar.focusDate(current);
							}

						} else {
							var current = new Date(now.getFullYear(), now.getMonth() - 1, 1);
							current.setHours(0, 0, 0, 0);
							if (current.getTime() < that.minFocusDate.getTime()) {
								this.calendar.focusDate(that.minFocusDate);
							} else {
								this.calendar.focusDate(current);
							}
						}
					}

				}
			} catch (e) {

			}
			//Getting entered hours for progress indicator
			if (this.getModel('controls').getProperty('/duplicateScreen') === false) {
				this.getEnteredHours(true);
			}

		},
		onSaveAdHocAssignment: function (oEvent) {
			var that = this;
			sap.ui.getCore().getMessageManager().removeAllMessages();
			var oControl = this.getModel("controls");
			var oContainer = this.getGlobalModel("AdHocModel").getData().fields;

			var oEditedTask = this.getModel("AdHocModel").getData();
			var oAssignmentDetails = this.getModel("adHocSaveAssignmentModel").getData();

			var oMessages = [];
			var oMessages1 = [];
			var invalidBracket = false;
			var valid = /^(([\w\d\-_\s(]*[\w\d\-_\s\)]))$/g;
			//check if permitted brackets are used correctly)
			//check for the name if valid
			if (oAssignmentDetails.assignmentName) {
				if (oAssignmentDetails.assignmentName.toString().includes("(") && !oAssignmentDetails.assignmentName.toString().includes(")")) {
					invalidBracket = true;
				} else if ((oAssignmentDetails.assignmentName.toString().includes(")")) && (!oAssignmentDetails.assignmentName.toString().includes(
						"("))) {
					invalidBracket = true;
				}
			}

			if (oAssignmentDetails.assignmentName === "" || oAssignmentDetails.assignmentName === null || invalidBracket == true) {
				this.getModel("adHocSaveAssignmentModel").setProperty("/assignmentNameError", "Error");
				this.getModel("adHocSaveAssignmentModel").setProperty("/assignmentNameErrorText", this.oBundle.getText("enterValidName"));
				oMessages1.push(1);

			} else {
				this.getModel("adHocSaveAssignmentModel").setProperty("/assignmentNameError", "None");
				this.getModel("adHocSaveAssignmentModel").setProperty("/assignmentNameErrorText", "");
			}
			if (!oAssignmentDetails.validFrom || !oAssignmentDetails.validTo) {
				this.getModel("adHocSaveAssignmentModel").setProperty("/assignmentValidityError", "Error");
				this.getModel("adHocSaveAssignmentModel").setProperty("/assignmentValidityErrorText", this.oBundle.getText("enterValidDates"));
				oMessages1.push(2);

			} else {
				this.getModel("adHocSaveAssignmentModel").setProperty("/assignmentValidityError", "None");
				this.getModel("adHocSaveAssignmentModel").setProperty("/assignmentValidityErrorText", "");
			}
			this.getModel("adHocSaveAssignmentModel").refresh();
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
						if (subElement.FieldName === "BEGUZ" && that.getModel("controls").getProperty("/assignmentClockTime")) {
							startTime = subElement;
							subElement.valueState = "None";
							subElement.valueStateText = "";
						}
						if (subElement.FieldName === "ENDUZ" && that.getModel("controls").getProperty("/assignmentClockTime")) {
							endTime = subElement;
							subElement.valueState = "None";
							subElement.valueStateText = "";
						}
					});
				});
			});

			this.getModel("AdHocModel").refresh();
			if (required === true) {
				oMessages.push(new sap.ui.core.message.Message({
					message: that.oBundle.getText("requiredField"),
					type: sap.ui.core.MessageType.Error,
					processor: this.getOwnerComponent().oMessageProcessor
				}));
			}

			if (oMessages.length > 0) {
				this.getModel('controls').setProperty('/validationAssignment', true);
				var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
				sap.m.MessageBox.error(
					that.oBundle.getText("error"), {
						title: that.oBundle.getText("requiredField"),
						actions: [sap.m.MessageBox.Action.CANCEL],
						styleClass: bCompact ? "sapUiSizeCompact" : "",

					});
				return;
			}

			if (oMessages1.length > 0) {
				return;
			}
			this.getModel('controls').setProperty('/validationAssignment', false);

			delete oEditedTask.assignmentNameError;
			delete oEditedTask.assignmentNameErrorText;
			delete oEditedTask.assignmentValidityError;
			delete oEditedTask
				.assignmentValidityErrorText;
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

						if (oContainer[index].containers[index1].form[index2].FieldName === "BEGUZ" || oContainer[index].containers[index1].form[
								index2]
							.FieldName === "ENDUZ") {
							if (this.getModel('controls').getProperty('/assignmentClockTime')) {
								if (startTime && endTime) {
									var val1 = this.formatter.convertAssignmentTime(startTime.FieldValue);
									var val2 = this.formatter.convertAssignmentTime(endTime.FieldValue);
									if (parseFloat(val1) || parseFloat(val2)) {
										oFormContainers.push({
											form: [oContainer[index].containers[index1].form[index2]]
										});
									}

								}
							}
							continue;
						}

						if (oContainer[index].containers[index1].form[index2].dummy === "true" || oContainer[index].containers[index1].form[index2].frontEndField ===
							true) {
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
							this.getModel("AdHocModel").getData().ApproverName;
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
			TaskData.AssignmentName = oAssignmentDetails.assignmentName;
			TaskData.AssignmentStatus = oAssignmentDetails.status ? "1" : "0";
			if (this.getModel('controls').getProperty('/assignmentClockTime')) {
				if (TaskData.AssignmentFields.BEGUZ) {
					TaskData.AssignmentFields.BEGUZ = this.formatter.convertAssignmentTime(TaskData.AssignmentFields.BEGUZ);
				}
				if (TaskData.AssignmentFields.ENDUZ) {
					TaskData.AssignmentFields.ENDUZ = this.formatter.convertAssignmentTime(TaskData.AssignmentFields.ENDUZ);
				}

			}
			TaskData.ValidityStartDate = this.formatter.formatToBackendString(oAssignmentDetails.validFrom) +
				"T00:00:00";
			TaskData.ValidityEndDate = this.formatter.formatToBackendString(oAssignmentDetails.validTo) +
				"T00:00:00";
			if (TaskData.AssignmentFields.PEDD !== null && TaskData.AssignmentFields.PEDD !== "" && TaskData.AssignmentFields.PEDD) {
				TaskData.AssignmentFields.PEDD = this.formatter.formatToBackendString(new Date(TaskData.AssignmentFields.PEDD)) + "T00:00:00";
			} else {
				TaskData.AssignmentFields.PEDD = null;
			}
			TaskData.AssignmentId = oFormContainers[0].form[0].AssignmentId;

			TaskData.AssignmentOperation = "C";
			TaskData.AssignmentId = "";
			this.SubmitTask(TaskData); //Will always be a creation of assignment

		},

		checkForNonChangingFields: function (oFields) {
			if (oFields.FieldName === "WORKDATE" || oFields.FieldName === "CATSHOURS" || oFields.FieldName === "STATUS" || oFields.FieldName ===
				"ENDUZ" || oFields.FieldName === "COUNTER") {
				return true;
			}

			if (oFields.FieldName === 'LONGTEXT') {
				return true;
			}
			return false;

		},
		fillAdHocTodoWorkListEntries: function (data) {
			var dataIndex = 0;
			var timeDataIndex = this.getModel("controls").getProperty("/index");
			var oData = this.getModel('TodoList').getData();
			var oContainer = this.getModel("AdHocModel").getData().fields;
			//Checking for approver allowed
			if (this.getModel('controls').getProperty('/approverAllowed')) {

				oData[timeDataIndex].ApproverId = data[dataIndex].ApproverId;
			}
			for (var index = 0; index < oContainer.length; index++) {
				for (var index1 = 0; index1 < oContainer[index].containers.length; index1++) {
					for (var index2 = 0; index2 < oContainer[index].containers[index1].form.length; index2++) {

						if (oContainer[index].containers[index1].form[index2].dummy === "true") {
							continue;
						} else if (oContainer[index].containers[index1].form[index2].frontEndField === true || this.checkForNonChangingFields(
								oContainer[
									index].containers[
									index1].form[index2].FieldName)) {
							continue;

						} else {
							oContainer[index].containers[index1].form[index2].FieldValue = data[dataIndex].AssignmentFields[oContainer[index].containers[
								index1].form[index2].FieldName];
						}
					}

				}
			}
			this.getModel("AdHocModel").refresh();
		},

		fillAdHocWorklistEntries: function (data) {
			//Only single entry will be there due to adhoc
			var dataIndex = 0;
			var timeDataIndex = this.getModel("controls").getProperty("/index");
			var oData = this.getModel('TimeData').getData();
			var oContainer = this.getModel("AdHocModel").getData().fields;
			//Checking for approver allowed
			if (this.getModel('controls').getProperty('/approverAllowed')) {

				oData[timeDataIndex].ApproverId = data[dataIndex].ApproverId;
			}
			for (var index = 0; index < oContainer.length; index++) {
				for (var index1 = 0; index1 < oContainer[index].containers.length; index1++) {
					for (var index2 = 0; index2 < oContainer[index].containers[index1].form.length; index2++) {

						if (oContainer[index].containers[index1].form[index2].dummy === "true") {
							continue;
						} else if (oContainer[index].containers[index1].form[index2].frontEndField === true || this.checkForNonChangingFields(
								oContainer[
									index].containers[
									index1].form[index2].FieldName)) {
							continue;

						} else {
							oContainer[index].containers[index1].form[index2].FieldValue = data[dataIndex].AssignmentFields[oContainer[index].containers[
								index1].form[index2].FieldName];
						}
					}

				}
			}
			this.getModel("AdHocModel").refresh();

		},
		adHocWorklistPopover: function () {
			var that = this;
			var oDialogController = {
				handleClose: function (event) {
					that._oPopover.close();
					that._oPopover.destroy();
				},
				handleConfirm: function (event) {
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
						Pernr: that.empID,
						ProfileId: "",
						ValidityStartDate: "",
						ValidityEndDate: ""
					};
					var selectedItems = [];
					var selectedItemsCount = 0;
					var worklistTable = that.byId("worklistAdHocTable");
					var oItems = worklistTable.getItems();
					var worklistData = that.getModel("Worklist").getData();
					var checkFlag = "";
					for (var i = 0; i < oItems.length; i++) {
						if (oItems[i].getProperty("selected") == true) {
							selectedItemsCount++;
							for (var j = 0; j < that.worklistFields.length; j++) {
								if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "NAME") {
									if (oItems[i].getCells()[j].getValue() === "") {
										oItems[i].getCells()[j].setValueState(sap.ui.core.ValueState.Error);
										//Set a flag for avoiding incorrect Import
										checkFlag = "X";
									}
									TaskData["AssignmentName"] = oItems[i].getCells()[j].getValue();
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "APPROVER") {
									TaskData["ApproverName"] = oItems[i].getCells()[j].getValue();
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "AssignmentStatus") {
									TaskData["AssignmentStatus"] = oItems[i].getCells()[j].getValue() ? "1" : "";
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "RANGE") {
									TaskData["ValidityStartDate"] = that.formatter.formatToBackendString(oItems[i].getCells()[j].getDateValue()) +
										"T00:00:00";
									TaskData["ValidityEndDate"] = that.formatter.formatToBackendString(oItems[i].getCells()[j].getSecondDateValue()) +
										"T00:00:00";
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "CPR_TEXT") {
									//Do nothing - Continue
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "CPR_OBJTEXT") {
									//Do nothing - Continue
								} else {
									// TaskData.AssignmentFields[oItems[i].getCells()[j].getCustomData()[0].getValue()] =
									// 	oItems[i].getCells()[j].getText();
									//if worklist is having the valid date for the field 
									if (worklistData[oItems[i].getBindingContext(
											"WorklistFields").getPath().split("/")[1]].WorkListDataFields[oItems[i].getCells()[j].getCustomData()[0].getValue()]) {
										TaskData.AssignmentFields[oItems[i].getCells()[j].getCustomData()[0].getValue()] = worklistData[oItems[i].getBindingContext(
											"WorklistFields").getPath().split("/")[1]].WorkListDataFields[oItems[i].getCells()[j].getCustomData()[0].getValue()];
									}
								}
								if (TaskData.AssignmentFields.CPR_GUID === "") {
									TaskData.AssignmentFields.CPR_GUID = worklistData[oItems[i].getBindingContext(
										"WorklistFields").getPath().split("/")[1]].WorkListDataFields.CPR_GUID;
								}
								if (TaskData.AssignmentFields.CPR_OBJGUID === "") {
									TaskData.AssignmentFields.CPR_OBJGUID = worklistData[oItems[i].getBindingContext(
										"WorklistFields").getPath().split("/")[1]].WorkListDataFields.CPR_OBJGUID;
								}
								// var data = $.extend(true, {}, selected);
								// selectedItems.push(data);
								if (TaskData.AssignmentFields.BWGRL === "") {
									TaskData.AssignmentFields.BWGRL = "0.00";
								}
								if (TaskData.AssignmentFields.PRICE === "") {
									TaskData.AssignmentFields.PRICE = "0.00";
								}
								if (TaskData.AssignmentFields.OFMNW === "") {
									TaskData.AssignmentFields.OFMNW = "0.00";
								}
								if (TaskData.AssignmentFields.PEDD !== null) {
									TaskData.AssignmentFields.PEDD = this.formatter.formatToBackendString(new Date(TaskData.AssignmentFields.PEDD)) +
										"T00:00:00";
								}
							}
							var data = $.extend(true, {}, TaskData);
							selectedItems.push(data);
						}
					}
					if (selectedItemsCount < 1) {
						var toastMsg = that.oBundle.getText("noSelectionMade");
						sap.m.MessageToast.show(toastMsg, {
							duration: 3000
						});
					} else {
						if (that.getModel('controls').getProperty('/currentAdHoc')) {
							that.fillAdHocWorklistEntries(selectedItems);
						} else {
							that.fillAdHocTodoWorkListEntries(selectedItems);
						}
						var toastMsg = that.oBundle.getText("Worklist imported Successfully");
						sap.m.MessageToast.show(toastMsg, {
							duration: 3000
						});
						that._oPopover.close();
						that._oPopover.destroy();
					}
				},
				onNavBack: function (event) {
					var oNavCon = Fragment.byId(that.getView().getId(), "NavC");
					oNavCon.back();
				},
				onValueHelp: this.onValueHelp.bind(this),
				switchState: this.formatter.switchState.bind(this),
				dynamicBindingColumnsWorklist: this.dynamicBindingColumnsWorklist.bind(this),
				dynamicBindingRowsWorklist: this.dynamicBindingRowsWorklist.bind(this)
			};
			// if (!this._oPopover) {
			this._oPopover = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.adHocWorklistFragment",
				oDialogController);
			this.getView().addDependent(this._oPopover);
			// }

			// delay because addDependent will do a async rerendering and the popover will immediately close without it
			jQuery.sap.delayedCall(0, this, function () {
				this._oPopover.open();
			});
		},

		onSelectionDraft: function (oEvent) {
			var that = this;
			var oModel = this.oTable.getModel('TimeData');
			var index = parseInt(oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1]);
			var data = oModel.getData();
			var counter = oEvent.getSource().getParent().getCustomData('counter')[0].getValue();
			if (counter && counter !== null) {
				data[index].TimeEntryOperation = 'U';
			} else {
				data[index].TimeEntryOperation = 'C';
			}
			oModel.refresh();
			if (that.checkButtonNeeded === "X") {
				that.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
				that.getModel("controls").setProperty("/isOverviewChanged", false);
				that.getModel("controls").setProperty("/overviewDataChanged", false);
			} else {
				that.getModel("controls").setProperty("/isOverviewChanged", true);
				that.getModel("controls").setProperty("/overviewDataChanged", true);
			}
			this.successfulCheck = "";
			sap.ushell.Container.setDirtyFlag(true);
		},
		onSelectionChange: function (oEvent) {
			var selectedKey = oEvent.getParameter('selectedItem').getKey();
			var selectedText = oEvent.getParameter('selectedItem').getText();

			if (selectedKey === "111") {
				//Loead Adhoc
				this.loadAdHocFragment(oEvent);
				return;
			}

			var oControls = this.getModel("controls").getData();
			if (oEvent.getParameter('selectedItem').getBindingContext('TasksWithGroups').getModel().getData()[parseInt(oEvent.getParameter(
					'selectedItem').getBindingContext('TasksWithGroups').getPath().split("/")[1])].Type === "group") {
				var entry;
				// var notValid = false;
				// var notActive = false;
				var toastMsg;
				var oModel = this.getModel('TimeData');
				var oGroups = this.getModel('AssignmentGroups').getData();
				var data = oModel.getData();
				var index = parseInt(oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1]);
				var oSelectedGroup = $.grep(oGroups, function (element, ind) {
					return element.groupId === selectedKey;
				});
				//group assignment check start
				var workdate = new Date(data[index].TimeEntryDataFields.WORKDATE);
				var groupAssignment = oSelectedGroup[0].Assignments;
				groupAssignment = $.grep(groupAssignment, function (e, i) {
					if (e.Status === "1") {
						return true;
					}
					// else {
					// 	notActive = true;
					// }
				});
				groupAssignment = $.grep(groupAssignment, function (e, i) {
					if (e.ValidityStartDate <= workdate && e.ValidityEndDate >= workdate) {
						return true;
					}
					// else {
					// 	notValid = true;
					// }
				});
				// if (notActive && notValid) {
				// 	toastMsg = this.getModel("i18n").getResourceBundle().getText('assignmentNotActiveValid');
				// } else if (notActive) {
				// 	toastMsg = this.getModel("i18n").getResourceBundle().getText('assignmentNotActive');
				// } else if (notValid) {
				// 	toastMsg = this.getModel("i18n").getResourceBundle().getText('assignmentNotValid');
				// }
				//group assignment check end

				groupAssignment = groupAssignment.sort(function (element1, element2) {
					//Sorting based on rank
					if (element1.Rank <= element2.Rank) {
						return -1;
					}
					return 1;
				});
				for (var i = groupAssignment.length - 1; i >= 0; i--) {

					var workdate = new Date(data[index].TimeEntryDataFields.WORKDATE);
					var hours = data[index].TimeEntryDataFields.CATSHOURS;
					var status = data[index].TimeEntryDataFields.STATUS;
					var startTime = data[index].TimeEntryDataFields.BEGUZ;
					var endTime = data[index].TimeEntryDataFields.ENDUZ;
					// delete data[index].TimeEntryDataFields;
					var taskdata = this.getModel('Tasks').getData();
					var task = $.grep(taskdata, function (element, ind) {
						return element.AssignmentId === groupAssignment[i].AssignmentId;
					});
					if (i === groupAssignment.length - 1) {
						data[index].TimeEntryDataFields = $.extend(true, {}, task[0].AssignmentFields);
						if (this.getModel('controls').getProperty('/approverAllowed')) {
							data[index].ApproverId = task[0].ApproverId;
						}
						data[index].AssignmentId = task[0].AssignmentId;
						data[index].AssignmentName = task[0].AssignmentName;
						data[index].TimeEntryDataFields
							.WORKDATE = workdate;
						data[index].TimeEntryDataFields.CATSHOURS = hours;
						data[index].TimeEntryDataFields.STATUS = status;
						if (!oControls.assignmentClockTime) {
							data[index].TimeEntryDataFields.BEGUZ = startTime;
							data[index].TimeEntryDataFields.ENDUZ = endTime;
						} else {
							if (data[index].TimeEntryDataFields.BEGUZ === "") {
								data[index].TimeEntryDataFields.BEGUZ = "000000";
							}
							if (data[index].TimeEntryDataFields.ENDUZ === "") {
								data[index].TimeEntryDataFields.ENDUZ = "000000";
							}
						}
						// insert.AssignmentName = selectedText;
						// insert.AssignmentId = selectedKey;
						if (data[index].Counter && data[index].Counter !== null && data[index].Counter !== "") {
							data[index].TimeEntryOperation = 'U';
							data[index].deleteButtonEnable = true;
							// if (i == oSelectedGroup[0].Assignments.length - 1) {
							data[index].addButtonEnable = true;
							// }

						} else {
							data[index].TimeEntryOperation = 'C';
							data[index].Counter = "";
							data[index].deleteButtonEnable = true;
							// if (i == oSelectedGroup[0].Assignments.length - 1) {
							data[index].addButtonEnable = true;
							// }
						}
						data[index].highlight = sap.ui.core.MessageType.Information;
						data[index].HeaderData.highlight = sap.ui.core.MessageType.Information;
						data[
							index].HeaderData.addButton = true;
						oModel.refresh();
					} else {
						var insert = $.extend(true, {}, data[index]);
						insert.TimeEntryDataFields = $.extend(true, {}, task[0].AssignmentFields);
						if (this.getModel('controls').getProperty('/approverAllowed')) {
							insert.ApproverId = task[0].ApproverId;
						}
						insert.AssignmentId = task[0].AssignmentId;
						insert.AssignmentName = task[0].AssignmentName;
						insert.TimeEntryDataFields.WORKDATE = workdate;
						insert.TimeEntryDataFields.CATSHOURS = hours;
						insert.TimeEntryDataFields.STATUS = status;
						if (!oControls.assignmentClockTime) {
							insert.TimeEntryDataFields.BEGUZ = startTime;
							insert.TimeEntryDataFields.ENDUZ = endTime;
						} else {
							if (insert.TimeEntryDataFields.BEGUZ === "") {
								insert.TimeEntryDataFields.BEGUZ = "000000";
							}
							if (insert.TimeEntryDataFields.ENDUZ === "") {
								insert.TimeEntryDataFields.ENDUZ = "000000";
							}
						}
						// insert.AssignmentName = selectedText;
						// insert.AssignmentId = selectedKey;
						// if (insert.Counter && insert.Counter !== null && insert.Counter !== "") {
						// 	insert.TimeEntryOperation = 'U';
						// 	insert.deleteButtonEnable = true;
						// 	if (i == oSelectedGroup[0].Assignments.length - 1) {
						// 		insert.addButtonEnable = true;
						// 	}

						// } else {
						insert.TimeEntryOperation = 'C';
						insert.Counter = "";
						insert.deleteButtonEnable = true;
						// if (i == oSelectedGroup[0].Assignments.length - 1) {
						insert.addButtonEnable = false;
						insert.addButton = false;
						// }
						// }
						insert.highlight = sap.ui.core.MessageType.Information;
						insert.HeaderData.highlight = sap.ui.core.MessageType.Information;
						insert.HeaderData.addButton = false;
						data.splice(index, 0, insert);
					}

				}
				// if (notActive || notValid) {
				// 	sap.m.MessageToast.show(toastMsg, {
				// 		duration: 3000
				// 	});
				// } else {

				if (groupAssignment.length === 0) {
					data[index].AssignmentId = "";
					data[index].AssignmentName = "";
					toastMsg = this.getModel("i18n").getResourceBundle().getText('noAssingmentImported');

				} else {
					toastMsg = this.getModel("i18n").getResourceBundle().getText('groupImported');

				}
				sap.m.MessageToast.show(toastMsg, {
					duration: 3000
				});
				//}
				//In Case of Assignment Group
				this.setFocusFixedElement();
				oModel.refresh();
				//Handling case for addition of Assignment
				var item = $.grep(this.oTable.getItems(), function (element, index) {
					if (!element.getAggregation('cells')) {
						return false;
					} else {
						return true;
					}
				});
				item[index].focus();
				// for (var content = 0; content < item[index].getCells().length; content++) {
				// 	try {
				// 		var key = item[index].getCells()[i].getSelectedKey();
				// 		item[index].getCells()[i].setSelectedKey(key);

				// 	} catch (exception) {

				// 	}
				// }
				//this.setModel(oModel, 'TimeData');
				//	this.setModel(new JSONModel(data), 'TimeData');
			} else {
				var entry;
				var longText = "";
				var LTXA1 = "";
				var oModel = this.getModel('TimeData');
				var data = oModel.getData();
				var index = parseInt(oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1]);
				var workdate = data[index].TimeEntryDataFields.WORKDATE;
				var hours = data[index].TimeEntryDataFields.CATSHOURS;
				var status = data[index].TimeEntryDataFields.STATUS;
				var startTime = data[index].TimeEntryDataFields.BEGUZ;
				var endTime = data[index].TimeEntryDataFields.ENDUZ;
				if (oModel.getData()[index].TimeEntryDataFields.LONGTEXT === 'X') {
					longText = oModel.getData()[index].TimeEntryDataFields.LONGTEXT_DATA;
					LTXA1 = oModel.getData()[index].TimeEntryDataFields.LTXA1;
				}
				delete data[index].TimeEntryDataFields;

				var taskdata = this.getModel('Tasks').getData();
				var task = $.grep(taskdata, function (element, ind) {
					return element.AssignmentId === selectedKey;
				});
				data[index].TimeEntryDataFields = $.extend(true, {}, task[0].AssignmentFields);
				if (this.getModel('controls').getProperty('/approverAllowed')) {
					data[index].ApproverId = task[0].ApproverId;
				}
				data[index].TimeEntryDataFields.WORKDATE = workdate;
				data[index].TimeEntryDataFields.CATSHOURS = hours;
				data[index].TimeEntryDataFields.STATUS = status;
				if (!oControls.assignmentClockTime) {
					data[index].TimeEntryDataFields.BEGUZ = startTime;
					data[index].TimeEntryDataFields.ENDUZ = endTime;
				} else {
					if (data[index].TimeEntryDataFields.BEGUZ === "") {
						data[index].TimeEntryDataFields.BEGUZ = "000000";
					}
					if (data[index].TimeEntryDataFields.ENDUZ === "") {
						data[index].TimeEntryDataFields.ENDUZ = "000000";
					}
				}
				data[index].AssignmentName = selectedText;
				data[index].AssignmentId = selectedKey;
				if (longText !== "") {
					data[index].TimeEntryDataFields.LONGTEXT = 'X';
					data[index].TimeEntryDataFields.LONGTEXT_DATA = longText;
					data[index].TimeEntryDataFields.LTXA1 = LTXA1;

				}
				if (data[index].Counter && data[index].Counter !== null && data[index].Counter !== "") {
					data[index].TimeEntryOperation = 'U';
					data[index].deleteButtonEnable = true;
					data[index].addButtonEnable = true;
				} else {
					data[index].TimeEntryOperation = 'C';
					data[index].Counter = "";
					data[index].deleteButtonEnable = true;
					data[index].addButtonEnable = true;
				}
				//	this.setFocusFixedElement();
				//In Case of Assignment
				oModel.refresh();
				//
			}
			// var item = $.grep(this.oTable.getItems(), function (element, index) {
			// 	if (!element.getAggregation('cells')) {
			// 		return false;
			// 	} else {
			// 		return true;
			// 	}
			// });
			//	this.setFocusFixedElement();
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isOverviewChanged", false);
				this.getModel("controls").setProperty("/overviewDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isOverviewChanged", true);
				this.getModel("controls").setProperty("/overviewDataChanged", true);
			}
			this.successfulCheck = "";
			sap.ushell.Container.setDirtyFlag(true);
			var x = oEvent.getSource();
			jQuery.sap.delayedCall(200, this, function () {
				x.setSelectedKey(x.getSelectedKey());
			});

		},
		onSelectionChangeToDo: function (oEvent) {
			var selectedKey = oEvent.getParameter('selectedItem').getKey();
			var selectedText = oEvent.getParameter('selectedItem').getText();
			if (selectedKey === "111") {
				//Loead Adhoc
				this.loadAdHocTodoFragment(oEvent);
				return;
			}
			var oControls = this.getModel("controls").getData();
			if (oEvent.getParameter('selectedItem').getBindingContext('TasksWithGroups').getModel().getData()[parseInt(oEvent.getParameter(
					'selectedItem').getBindingContext('TasksWithGroups').getPath().split("/")[1])].Type === "group") {
				var entry;
				// var notValid = false;
				// var notActive = false;
				var toastMsg;
				var oModel = this.getModel('TodoList');
				var oGroups = this.getModel('AssignmentGroups').getData();
				var data = oModel.getData();
				var index = parseInt(oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1]);
				var oSelectedGroup = $.grep(oGroups, function (element, ind) {
					return element.groupId === selectedKey;
				});
				//group assignment check start
				var workdate = new Date(data[index].TimeEntryDataFields.WORKDATE);
				var groupAssignment = oSelectedGroup[0].Assignments;
				groupAssignment = $.grep(groupAssignment, function (e, i) {
					if (e.Status === "1") {
						return true;
					}
					// else {
					// 	notActive = true;
					// }
				});
				groupAssignment = $.grep(groupAssignment, function (e, i) {
					if (e.ValidityStartDate <= workdate && e.ValidityEndDate >= workdate) {
						return true;
					}
					// else {
					// 	notValid = true;
					// }
				});
				// if (notActive && notValid) {
				// 	toastMsg = this.getModel("i18n").getResourceBundle().getText('assignmentNotActiveValid');
				// } else if (notActive) {
				// 	toastMsg = this.getModel("i18n").getResourceBundle().getText('assignmentNotActive');
				// } else if (notValid) {
				// 	toastMsg = this.getModel("i18n").getResourceBundle().getText('assignmentNotValid');
				// }
				//group assignment check end
				groupAssignment = groupAssignment.sort(function (element1, element2) {
					//Sorting based on rank
					if (element1.Rank <= element2.Rank) {
						return -1;
					}
					return 1;
				});
				for (var i = groupAssignment.length - 1; i >= 0; i--) {
					var workdate = new Date(data[index].TimeEntryDataFields.WORKDATE);
					var hours = data[index].TimeEntryDataFields.CATSHOURS;
					var status = data[index].TimeEntryDataFields.STATUS;
					var startTime = data[index].TimeEntryDataFields.BEGUZ;
					var endTime = data[index].TimeEntryDataFields.ENDUZ;
					// delete data[index].TimeEntryDataFields;
					var taskdata = this.getModel('Tasks').getData();
					var task = $.grep(taskdata, function (element, ind) {
						return element.AssignmentId === groupAssignment[i].AssignmentId;
					});
					if (i === groupAssignment.length - 1) {
						data[index].TimeEntryDataFields = $.extend(true, {}, task[0].AssignmentFields);
						if (this.getModel('controls').getProperty('/approverAllowed')) {
							data[index].ApproverId = task[0].ApproverId;
						}
						data[index].AssignmentId = task[0].AssignmentId;
						data[index].AssignmentName = task[0].AssignmentName;
						data[index].TimeEntryDataFields.WORKDATE = workdate;
						data[index].TimeEntryDataFields.CATSHOURS = hours;
						data[index].TimeEntryDataFields.STATUS = status;
						if (!oControls.assignmentClockTime) {
							data[index].TimeEntryDataFields.BEGUZ = startTime;
							data[index].TimeEntryDataFields.ENDUZ = endTime;
						} else {
							if (data[index].TimeEntryDataFields.BEGUZ === "") {
								data[index].TimeEntryDataFields.BEGUZ = "000000";
							}
							if (data[index].TimeEntryDataFields.ENDUZ === "") {
								data[index].TimeEntryDataFields.ENDUZ = "000000";
							}
						}
						data[index].highlight = sap.ui.core.MessageType.Information;
						// insert.AssignmentName = selectedText;
						// insert.AssignmentId = selectedKey;
						if (data[index].Counter && data[index].Counter !== null && data[index].Counter !== "") {
							data[index].TimeEntryOperation = 'U';
							data[index].deleteButtonEnable = true;
							// if (i == oSelectedGroup[0].Assignments.length - 1) {
							data[index].addButtonEnable = true;
							// }

						} else {
							data[index].TimeEntryOperation = 'C';
							data[index].Counter = "";
							data[index].deleteButtonEnable = true;
							// if (i == oSelectedGroup[0].Assignments.length - 1) {
							data[index].addButtonEnable = true;
							// }
						}

					} else {
						var insert = $.extend(true, {}, data[index]);
						insert.TimeEntryDataFields = $.extend(true, {}, task[0].AssignmentFields);
						if (this.getModel('controls').getProperty('/approverAllowed')) {
							insert.ApproverId = task[0].ApproverId;
						}
						insert.AssignmentId = task[0].AssignmentId;
						insert.AssignmentName = task[0].AssignmentName;
						insert.TimeEntryDataFields.WORKDATE = workdate;
						insert.TimeEntryDataFields.CATSHOURS = hours;
						insert.TimeEntryDataFields.STATUS = status;
						if (!oControls.assignmentClockTime) {
							insert.TimeEntryDataFields.BEGUZ = startTime;
							insert.TimeEntryDataFields.ENDUZ = endTime;
						} else {
							if (insert.TimeEntryDataFields.BEGUZ === "") {
								insert.TimeEntryDataFields.BEGUZ = "000000";
							}
							if (insert.TimeEntryDataFields.ENDUZ === "") {
								insert.TimeEntryDataFields.ENDUZ = "000000";
							}
						}
						insert.highlight = sap.ui.core.MessageType.Information;
						// insert.AssignmentName = selectedText;
						// insert.AssignmentId = selectedKey;
						insert.TimeEntryOperation = 'C';
						insert.Counter = "";
						insert.deleteButtonEnable = true;
						// if (i == oSelectedGroup[0].Assignments.length - 1) {
						// 	insert.addButtonEnable = true;
						// }
						insert.addButton = false;
						// insert.highlight = sap.ui.core.MessageType.Information;
						// insert.HeaderData.highlight = sap.ui.core.MessageType.Information;
						// insert.HeaderData.addButton = true;
						data.splice(index, 0, insert);
					}

				}
				// if (notActive || notValid) {
				// 	sap.m.MessageToast.show(toastMsg, {
				// 		duration: 3000
				// 	});
				// } else {
				if (groupAssignment.length === 0) {
					data[index].AssignmentId = "";
					data[index].AssignmentName = "";
					toastMsg = this.getModel("i18n").getResourceBundle().getText('noAssingmentImported');

				} else {
					toastMsg = this.getModel("i18n").getResourceBundle().getText('groupImported');
				}
				sap.m.MessageToast.show(toastMsg, {
					duration: 3000
				});
				//}

				var item = $.grep(this.oToDoTable.getItems(), function (element, index) {
					if (!element.getAggregation('cells')) {
						return false;
					} else {
						return true;
					}
				});
				this.setFocusFixedElement();
				oModel.refresh();
				item[index].focus();
				// for (var content = 0; content < item[index].getCells().length; content++) {
				// 	try {
				// 		var key = item[index].getCells()[i].getSelectedKey();
				// 		item[index].getCells()[i].setSelectedKey(key);

				// 	} catch (exception) {

				// 	}
				// }
			} else {
				var entry;
				var oModel = this.getModel('TodoList');
				var data = oModel.getData();
				var index = parseInt(oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1]);
				var workdate = data[index].TimeEntryDataFields.WORKDATE;
				var hours = data[index].TimeEntryDataFields.CATSHOURS;
				var status = data[index].TimeEntryDataFields.STATUS;
				var startTime = data[index].TimeEntryDataFields.BEGUZ;
				var endTime = data[index].TimeEntryDataFields.ENDUZ;
				delete data[index].TimeEntryDataFields;
				var taskdata = this.getModel('Tasks').getData();
				var task = $.grep(taskdata, function (element, ind) {
					return element.AssignmentId === selectedKey;
				});
				data[index].TimeEntryDataFields = $.extend(true, {}, task[0].AssignmentFields);
				if (this.getModel('controls').getProperty('/approverAllowed')) {
					data[index].ApproverId = task[0].ApproverId;
				}
				data[index].TimeEntryDataFields.WORKDATE = workdate;
				data[index].TimeEntryDataFields.CATSHOURS = hours;
				data[index].TimeEntryDataFields.STATUS = status;
				if (!oControls.assignmentClockTime) {
					data[index].TimeEntryDataFields.BEGUZ = startTime;
					data[index].TimeEntryDataFields.ENDUZ = endTime;
				} else {
					if (data[index].TimeEntryDataFields.BEGUZ === "") {
						data[index].TimeEntryDataFields.BEGUZ = "000000";
					}
					if (data[index].TimeEntryDataFields.ENDUZ === "") {
						data[index].TimeEntryDataFields.ENDUZ = "000000";
					}
				}
				data[index].highlight = sap.ui.core.MessageType.Information;
				data[index].AssignmentName = selectedText;
				data[index].AssignmentId = selectedKey;
				if (data[index].Counter && data[index].Counter !== null && data[index].Counter !== "") {
					data[index].TimeEntryOperation = 'U';
					data[index].deleteButtonEnable = true;
					data[index].addButtonEnable = true;
				} else {
					data[index].TimeEntryOperation = 'C';
					data[index].Counter = "";
					data[index].deleteButtonEnable = true;
					data[index].addButtonEnable = true;
				}
				// oModel.setData(data);
				// this.setModel(oModel, 'TodoList');
				oModel.refresh();
			}
			// var item = $.grep(this.oToDoTable.getItems(), function (element, index) {
			// 	if (!element.getAggregation('cells')) {
			// 		return false;
			// 	} else {
			// 		return true;
			// 	}
			// });
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/todoDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isToDoChanged", false);
				this.getModel("controls").setProperty("/todoDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isToDoChanged", true);
				this.getModel("controls").setProperty("/todoDataChanged", true);
			}
			sap.ushell.Container.setDirtyFlag(true);
			this.successfulToDoCheck = "";
			var x = oEvent.getSource();
			//In latest versions of ui5 doesn't clear the control so need this manual handling and calling it after a delay
			jQuery.sap.delayedCall(200, this, function () {
				x.setSelectedKey(x.getSelectedKey());
			});

		},
		getFocusPosition: function (index) {

			var mapIndex = 0; //Item index
			var itemIndex = 0;
			var item = $.grep(this.oTable.getItems(), function (element, ind) {
				if (!element.getAggregation('cells')) {
					return false;
				} else {
					if (mapIndex === index) {
						itemIndex = ind;
					}
					mapIndex++;
					return true;
				}
			});
			var getMappingIndex = itemIndex;
			if (!this.oTable.getItems()[getMappingIndex - 1].getAggregation('cells')) {

				return index;

			} else {
				if (this.oTable.getItems()[getMappingIndex + 1] && !this.oTable.getItems()[getMappingIndex + 1].getAggregation('cells')) {
					return index - 1;

				}

				if (!this.oTable.getItems()[getMappingIndex + 1]) {
					return index - 1;

				}
				if (this.oTable.getItems()[getMappingIndex + 1] && this.oTable.getItems()[getMappingIndex + 1].getAggregation('cells'))
					return index;

			}

		},
		onOverviewDeleteRow: function (oEvent) {
			var that = this;
			var singleFlag = false;
			this.oTable.setBusy(true);
			var counter = oEvent.getSource().getParent().getParent().getCustomData('counter')[0].getValue();
			var oModel = this.getModel('TimeData');
			var data = oModel.getData();
			this.setModel(oModel, 'OriginalTime');
			var index = parseInt(oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1]);
			var focusPosition = 1;
			if (sap.ui.Device.system.phone) {
				focusPosition = -1;
			} else {
				focusPosition = this.getFocusPosition(index);
			}
			var deleteRow = $.extend(true, {}, data[index]);
			var delModel = this.getModel('deleteRecords');
			var deleteArray = this.getModel('deleteRecords').getData();
			var recordTemplate = this.recordTemplate();
			if (data[index].Counter && data[index].Counter != null) {
				if (deleteArray.length) {
					deleteArray.push(deleteRow);
					delModel.setData(deleteArray);
				} else {
					delModel.setData([deleteRow]);
				}
				//		this.setFocusFixedElement();
				this.setModel(delModel, 'deleteRecords');
			}
			var otherRecords = $.grep(data, function (element, ind) {
				return that.oFormatyyyymmdd.format(new Date(element.TimeEntryDataFields.WORKDATE)) === that.oFormatyyyymmdd.format(new Date(
					data[
						index].TimeEntryDataFields
					.WORKDATE)) && element.Status !== '99';
			});
			var date = that.oFormatyyyymmdd.format(new Date(data[
					index].TimeEntryDataFields
				.WORKDATE));
			if (otherRecords.length >= 2) {
				data.splice(index, 1);
				var otherRecords = $.grep(data, function (element, ind) {
					return that.oFormatyyyymmdd.format(new Date(element.TimeEntryDataFields.WORKDATE)) === date && element.Status !== '99';
				});
				otherRecords[otherRecords.length - 1].addButtonEnable = true;
				otherRecords[otherRecords.length - 1].addButton = true;
				otherRecords[otherRecords.length - 1].HeaderData.addButton = true;
				data = this.calculateSum(new Date(otherRecords[otherRecords.length - 1].TimeEntryDataFields.WORKDATE), data);
				this.setFocusFixedElement();
				// oModel.setData(data);
				// this.setModel(oModel, 'TimeData');
				oModel.refresh();
			} else {
				var recordTemplate = this.recordTemplate();
				data[index].AssignmentId = "";
				data[index].AssignmentName = "";
				data[index].addButton = true;
				data[index].deleteButtonEnable = false;
				data[index].addButtonEnable = false;
				data[index].SetDraft = false;
				data[index].HeaderData.addButton = true;
				data[index].Counter = "";
				data[index].valueState = "None";
				data[index].valueStateText = "";
				data[index].highlight = "None";
				data[index].TimeEntryOperation = "";
				Object.getOwnPropertyNames(data[index].TimeEntryDataFields).forEach(function (prop) {
					if (prop == "WORKDATE") {} else {
						data[index].TimeEntryDataFields[prop] = recordTemplate.TimeEntryDataFields[prop];
					}
				});

				this.getModel('OverviewAttributes').setProperty('/state', this.getModel('OverviewAttributes').getProperty('/state') ^ 1);
				data = this.calculateSum(new Date(data[index].TimeEntryDataFields.WORKDATE), data);
				//		this.setFocusFixedElement();
				oModel.refresh();
				//	this.setModel(oModel, 'TimeData');
				singleFlag = true;
			}

			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isOverviewChanged", false);
				this.getModel("controls").setProperty("/overviewDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isOverviewChanged", true);
				this.getModel("controls").setProperty("/overviewDataChanged", true);
			}
			this.successfulCheck = "";
			sap.ushell.Container.setDirtyFlag(true);
			this.oTable.setBusy(false);
			var item = $.grep(this.oTable.getItems(), function (element, index) {
				if (!element.getAggregation('cells')) {
					return false;
				} else {
					return true;
				}
			});
			if (singleFlag) {
				for (var i = 0; i < item[index].getCells().length; i++) {
					try {
						item[index].getCells()[i].getSelectedKey();
						item[index].getCells()[i].setSelectedKey("");
					} catch (exception) {

					}
				}
			}
			try {

				if (focusPosition !== -1 && item[focusPosition]) {
					item[focusPosition].focus();
				} else {
					item[index - 1].focus();
				}
			} catch (e) {}
			that.getEnteredHours(true);

		},
		onOverviewAddRow: function (oEvent) {
			this.oTable.setBusy(true);
			var newRecord = this.recordTemplate();
			var oControls = this.getModel("controls");
			var counter = oEvent.getSource().getParent().getParent().getCustomData('counter')[0].getValue();
			var oModel = this.getModel('TimeData');
			var index = parseInt(oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1]);
			var data = oModel.getData();
			data[index].addButton = false;
			var insert = $.extend(true, {}, newRecord);
			insert.totalHours = data[index].totalHours;
			insert.TimeEntryDataFields.WORKDATE = new Date(data[index].TimeEntryDataFields.WORKDATE);
			insert.target = data[index].target;
			insert.HeaderData = $.extend(true, {}, data[index].HeaderData);
			data[index].HeaderData.addButton = false;
			insert.highlight = sap.ui.core.MessageType.Information;
			insert.HeaderData.highlight = true;
			insert.HeaderData.addButton = true;
			insert.addButton = true;
			data.splice(index + 1, 0, insert);
			this.setFocusFixedElement();
			oModel.refresh();
			//this.setModel(oModel, 'TimeData');
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isOverviewChanged", false);
				this.getModel("controls").setProperty("/overviewDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isOverviewChanged", true);
				this.getModel("controls").setProperty("/overviewDataChanged", true);
			}
			this.successfulCheck = "";
			sap.ushell.Container.setDirtyFlag(true);
			var item = $.grep(this.oTable.getItems(), function (element, index) {
				if (!element.getAggregation('cells')) {
					return false;
				} else {
					return true;
				}
			});
			item[index + 1].focus();
			this.oTable.setBusy(false);
		},
		onTodoAddRow: function (oEvent) {
			this.oToDoTable.setBusy(true);
			var newRecord = this.recordTemplate();
			var counter = oEvent.getSource().getParent().getParent().getCustomData('counter')[0].getValue();
			var oModel = this.getModel('TodoList');
			var index = parseInt(oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1]);
			var data = oModel.getData();
			data[index].addButton = false;
			var insert = $.extend(true, {}, data[index]);
			insert.TimeEntryDataFields = newRecord.TimeEntryDataFields;
			insert.TimeEntryDataFields.WORKDATE = new Date(data[index].TimeEntryDataFields.WORKDATE);
			insert.AssignmentId = "";
			insert.AssignmentName = "";
			insert.TimeEntryDataFields.CATSHOURS = "0.00";
			insert.TimeEntryDataFields.STATUS = "";
			insert.Counter = "";
			insert.valueState = "None";
			insert.highlight = sap.ui.core.MessageType.Information;
			// insert.total = parseFloat(0.00).toFixed(2);
			insert.addButton = true;
			data.splice(index + 1, 0, insert);
			this.setFocusFixedElement();
			oModel.refresh();
			// oModel.setData(data);
			//this.setModel(oModel, 'TodoList');
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/todoDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isToDoChanged", false);
				this.getModel("controls").setProperty("/todoDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isToDoChanged", true);
				this.getModel("controls").setProperty("/todoDataChanged", true);
			}
			sap.ushell.Container.setDirtyFlag(true);
			this.successfulToDoCheck = "";
			this.oToDoTable.setBusy(false);
			var item = $.grep(this.oToDoTable.getItems(), function (element, index) {
				if (!element.getAggregation('cells')) {
					return false;
				} else {
					return true;
				}
			});
			item[index + 1].focus();

		},
		onTodoDeleteRow: function (oEvent) {
			var that = this;
			var singleFlag = false;
			this.oToDoTable.setBusy(true);
			var counter = oEvent.getSource().getParent().getParent().getCustomData('counter')[0].getValue();

			var oModel = this.getModel('TodoList');
			var data = oModel.getData();
			this.setModel(oModel, 'OriginalTodoTime');
			var index = parseInt(oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1]);
			var deleteRow = $.extend(true, {}, data[index]);
			var delModel = this.getModel('deleteRecords');
			var deleteArray = this.getModel('deleteRecords').getData();
			var recordTemplate = this.recordTemplate();
			// if (data[index].Counter && data[index].Counter != null) {
			// 	if (deleteArray.length) {
			// 		deleteArray.push(deleteRow);
			// 		delModel.setData(deleteArray);
			// 	} else {
			// 		delModel.setData([deleteRow]);
			// 	}
			// 	this.setModel(delModel, 'deleteRecords');
			// }
			var otherRecords = $.grep(data, function (element, ind) {
				return that.oFormatyyyymmdd.format(new Date(element.TimeEntryDataFields.WORKDATE)) === that.oFormatyyyymmdd.format(new Date(
					data[
						index].TimeEntryDataFields
					.WORKDATE));
			});
			var date = that.oFormatyyyymmdd.format(new Date(data[
					index].TimeEntryDataFields
				.WORKDATE));
			if (otherRecords.length >= 2) {
				// if(index!==0 && index > 0 ){
				// data[index-1].addButtonEnable = true;
				// data[index-1].addButton = true;	
				// }
				data.splice(index, 1);
				var otherRecords = $.grep(data, function (element, ind) {
					return that.oFormatyyyymmdd.format(new Date(element.TimeEntryDataFields.WORKDATE)) === date;
				});
				otherRecords[otherRecords.length - 1].addButtonEnable = true;
				otherRecords[otherRecords.length - 1].addButton = true;
				data = this.calculateSumToDo(new Date(otherRecords[otherRecords.length - 1].TimeEntryDataFields.WORKDATE), data);
				this.setFocusFixedElement();
				oModel.refresh();
				// oModel.setData(data);
				// this.setModel(oModel, 'TodoList');
			} else {
				data[index].AssignmentId = "";
				data[index].AssignmentName = "";
				data[index].addButton = true;
				data[index].deleteButtonEnable = false;

				data[index].addButtonEnable = true;
				data[index].valueState = "None";
				data[index].valueStateText = "";
				data[index].highlight = "None";
				data[index].TimeEntryOperation = "";
				Object.getOwnPropertyNames(data[index].TimeEntryDataFields).forEach(function (prop) {
					if (prop == "WORKDATE") {} else {
						data[index].TimeEntryDataFields[prop] = recordTemplate.TimeEntryDataFields[prop];
					}
				});
				this.getModel('ToDoAttributes').setProperty('/state', this.getModel('ToDoAttributes').getProperty('/state') ^ 1);

				data = this.calculateSumToDo(new Date(data[index].TimeEntryDataFields.WORKDATE), data);
				this.setFocusFixedElement();
				oModel.refresh();
				singleFlag = true;
			}
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/todoDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isToDoChanged", false);
				this.getModel("controls").setProperty("/todoDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isToDoChanged", true);
				this.getModel("controls").setProperty("/todoDataChanged", true);
			}
			sap.ushell.Container.setDirtyFlag(true);
			this.successfulToDoCheck = "";
			this.oToDoTable.setBusy(false);
			var item = $.grep(this.oToDoTable.getItems(), function (element, index) {
				if (!element.getAggregation('cells')) {
					return false;
				} else {
					return true;
				}
			});
			if (singleFlag) {
				try {
					for (var i = 0; i < item[index].getCells().length; i++) {
						item[index].getCells()[i].getSelectedKey();
						item[index].getCells()[i].setSelectedKey("");
					}
				} catch (exception) {

				}
			}

			if (item.length > 0) {
				item[index].focus();
			}
		},

		getEnteredHours: function (liveChangeHours) //Called when binding for the table will be created
			{
				if (liveChangeHours === undefined) //No live change is occuring
				{
					liveChangeHours = false;
				}
				if (sap.ui.Device.system.phone || this.dailyView === 'X') {
					var aSelectedDates;
					var dailyViewFlag = false;
					if (this.dailyView === 'X') {
						aSelectedDates = this.calendar.getSelectedDates();
						dailyViewFlag = true;
					}
					if (sap.ui.Device.system.phone) {
						aSelectedDates = this.mCalendar.getSelectedDates();
					}

					if (aSelectedDates.length === 0) {
						return;
					}

					var targetHours = 0; //Target Hours for the selection
					var totalHours = 0; //Total Hours for the selection
					var submitted = 0; //Hours that are in status 20
					var approved = 0; //Hours that are in status 30
					var rejected = 0; // Hours that are in status 40
					var draft = 0; //Hours that are in status 10 
					var extraHours = 0; //Extra hours if recorded in a week
					var timeRemaining = 0; //Hours left to be recorded in a week
					var selectedDate = new Date(aSelectedDates[0].getStartDate());
					selectedDate.setHours(0);
					selectedDate.setMinutes(0);
					selectedDate.setSeconds(0);
					selectedDate.setMilliseconds(0);

					var start = this.getFirstDayOfWeek(selectedDate, this.firstDayOfWeek);
					var end = this.getLastDayOfWeek(selectedDate, this.firstDayOfWeek);
					//Getting data for Selected Week
					var oData = this.getModel("TimeEntries").getProperty("/");
					var oDataCurrentDate = [];
					var weekSelectionData = $.grep(oData, function (element, index) {
						if (start.getTime() <= element.CaleDate.getTime() && selectedDate.getTime() !==
							element.CaleDate.getTime() && end.getTime() >= element.CaleDate.getTime()) {
							return true;
						}
						if (selectedDate.getTime() === element.CaleDate.getTime()) {
							oDataCurrentDate.push(element);
						}
						return false;
					});

					var oDateMap = {}; //Record for each date
					weekSelectionData.forEach(function (element) {
						var oHours = {
							total: 0,
							target: 0,
							extra: 0
						};
						oHours.target = element.TargetHours;
						element.TimeEntries.results.forEach(function (element) {
							if (element.TimeEntryDataFields.STATUS === "10") {
								draft = draft + parseFloat(element.TimeEntryDataFields.CATSHOURS);
							}

							if (element.TimeEntryDataFields.STATUS === "20") {
								submitted = submitted + parseFloat(element.TimeEntryDataFields.CATSHOURS);
							}

							if (element.TimeEntryDataFields.STATUS === "30" || element.TimeEntryDataFields.STATUS === "99") {
								approved = approved + parseFloat(element.TimeEntryDataFields.CATSHOURS);

							}

							if (element.TimeEntryDataFields.STATUS === "40") {
								rejected = rejected + parseFloat(element.TimeEntryDataFields.CATSHOURS);
							}

							if (element.TimeEntryDataFields.STATUS === "10" || element.TimeEntryDataFields.STATUS === "20" || element.TimeEntryDataFields
								.STATUS === "30" || element.TimeEntryDataFields
								.STATUS === "99") {
								oHours.total = oHours.total + parseFloat(element.TimeEntryDataFields.CATSHOURS);
								oHours.extra = oHours.extra + parseFloat(element.TimeEntryDataFields.CATSHOURS);
							}
						});

						oDateMap[element.CaleDate.getTime()] = oHours;
					});

					var oCurrentData = this.oTable.getModel('TimeData').getProperty("/");

					oCurrentData.forEach(function (element) {
						var oHours = {
							total: 0,
							target: 0,
							extra: 0
						};
						if ((parseFloat(element.HeaderData.target) < parseFloat(element.HeaderData.sum)))
						//If Target is less than recorded we are not considering upward and downward tolerence 
						{
							oHours.total = element.HeaderData.sum;
							oHours.target = element.HeaderData.target;
							oHours.extra = element.HeaderData.sum;
							oDateMap[element.HeaderData.date.getTime()] = oHours;
						} else {
							oHours.total = element.HeaderData.sum;
							oHours.target = element.HeaderData.target;
							oHours.extra = element.HeaderData.sum;
							oDateMap[element.HeaderData.date.getTime()] = oHours;

						}
						if (element.TimeEntryDataFields.STATUS === "10" && !liveChangeHours) {
							draft = draft + parseFloat(element.TimeEntryDataFields.CATSHOURS);
						}

						if (element.TimeEntryDataFields.STATUS === "10" && liveChangeHours) {
							for (var i = 0; i < oDataCurrentDate.length; i++) {
								oDataCurrentDate[i].TimeEntries.results.forEach(function (element, index) {
									if (element.TimeEntryDataFields.STATUS === "10") {
										draft = draft + parseFloat(element.TimeEntryDataFields.CATSHOURS);
									}
								});
							}
						}

						if (element.TimeEntryDataFields.STATUS === "20" && !liveChangeHours) {
							submitted = submitted + parseFloat(element.TimeEntryDataFields.CATSHOURS);
						}
						if (element.TimeEntryDataFields.STATUS === "20" && liveChangeHours) {
							for (var i = 0; i < oDataCurrentDate.length; i++) {
								oDataCurrentDate[i].TimeEntries.results.forEach(function (element, index) {
									if (element.TimeEntryDataFields.STATUS === "20") {
										submitted = submitted + parseFloat(element.TimeEntryDataFields.CATSHOURS);
									}
								});
							}
						}

						if ((element.TimeEntryDataFields.STATUS === "30" || element.TimeEntryDataFields.STATUS === "99") && !liveChangeHours) {
							approved = approved + parseFloat(element.TimeEntryDataFields.CATSHOURS);

						}
						if ((element.TimeEntryDataFields.STATUS === "30" || element.TimeEntryDataFields.STATUS === "99") && liveChangeHours) {
							if ((element.TimeEntryDataFields.STATUS === "30" || element.TimeEntryDataFields.STATUS === "99") && liveChangeHours) {
								for (var i = 0; i < oDataCurrentDate.length; i++) {
									oDataCurrentDate[i].TimeEntries.results.forEach(function (element, index) {
										if (element.TimeEntryDataFields.STATUS === "30" || element.TimeEntryDataFields.STATUS === "99") {
											approved = approved + parseFloat(element.TimeEntryDataFields.CATSHOURS);
										}
									});
								}
							}
						}

						if (element.TimeEntryDataFields.STATUS === "40" && liveChangeHours) {
							rejected = rejected + parseFloat(element.TimeEntryDataFields.CATSHOURS);
						}

						if (element.TimeEntryDataFields.STATUS === "40" && liveChangeHours) {
							for (var i = 0; i < oDataCurrentDate.length; i++) {
								oDataCurrentDate[i].TimeEntries.results.forEach(function (element, index) {
									if (element.TimeEntryDataFields.STATUS === "40") {
										rejected = rejected + parseFloat(element.TimeEntryDataFields.CATSHOURS);
									}
								});
							}
						}

					});
					var hoursArray = $.map(oDateMap, function (val) {
						return val;
					});
					hoursArray.forEach(function (date, value) {
						totalHours = totalHours + parseFloat(date.total);
						targetHours = targetHours + parseFloat(date.target);

					});

					if (targetHours > totalHours) //Remaining hours
					{
						timeRemaining = targetHours - totalHours;
						extraHours = 0;
					} else {
						extraHours = totalHours - targetHours;
						timeRemaining = 0;
					}

					//Fixing to 2 decimal places
					submitted = submitted.toFixed(2);
					targetHours = targetHours.toFixed(2);
					totalHours = totalHours.toFixed(2);
					extraHours = extraHours.toFixed(2);
					timeRemaining = timeRemaining.toFixed(2);
					draft = draft.toFixed(2);
					approved = approved.toFixed(2);
					rejected = rejected.toFixed(2);

					this.getView().getModel("TotalHours").setProperty("/TargetHours", targetHours);
					this.getView().getModel("TotalHours").setProperty("/TotalHours", totalHours);
					// var newLine = "\n";
					// var tooltipText =
					// 	`${newLine} Target Hours : ${targetHours}${newLine} Total Hours : ${totalHours}${newLine} Remaining Hours : ${timeRemaining}${newLine} Extra Hours : ${extraHours}${newLine} Draft Hours : ${draft}${newLine} Submitted Hours : ${submitted}${newLine} Approved Hours : ${approved}${newLine} Rejected Hours : ${rejected}${newLine}`;
					// this.getView().getModel("TotalHours").setProperty("/ToolTipText", tooltipText);
					// this.byId("progressIndicator").setAggregation("tooltip", tooltipText);
					var oQuickViewData = [{
						Label: this.getModel("i18n").getResourceBundle().getText('target'),
						Value: targetHours
					}, {
						Label: this.getModel("i18n").getResourceBundle().getText('recorded'),
						Value: totalHours

					}, {
						Label: this.getModel("i18n").getResourceBundle().getText('draft'),
						Value: draft
					}, {
						Label: this.getModel("i18n").getResourceBundle().getText('Submitted'),
						Value: submitted
					}, {
						Label: this.getModel("i18n").getResourceBundle().getText('Approved'),
						Value: approved
					}, {
						Label: this.getModel("i18n").getResourceBundle().getText('Rejected'),
						Value: rejected
					}];

					this.setModel(new JSONModel(oQuickViewData), "ProgressView");

				} else {
					var aSelectedDates = this.calendar.getSelectedDates();
					if (aSelectedDates.length === 0) {
						return;
					}
					var selectedDate = new Date(aSelectedDates[0].getStartDate());
					selectedDate.setHours(0);
					selectedDate.setMinutes(0);
					selectedDate.setSeconds(0);
					selectedDate.setMilliseconds(0);
					var start = this.getFirstDayOfWeek(selectedDate, this.firstDayOfWeek);
					var end = this.getLastDayOfWeek(selectedDate, this.firstDayOfWeek);
					//Getting data for Selected Week
					var oWeeklyData = this.getModel("TimeEntries").getProperty("/");

					var weekSelectionData = $.grep(oWeeklyData, function (element, index) {
						if (start.getTime() <= element.CaleDate.getTime() && end.getTime() >= element.CaleDate.getTime()) {
							return true;
						}

						return false;
					});

					var oData = this.oTable.getModel('TimeData').getProperty("/"); //Getting table binding context of the week
					if (oData.length === 0) {
						return;

					}
					var oHours = {
						total: 0,
						target: 0,
						extra: 0
					};
					var targetHours = 0; //Target Hours for the selection
					var totalHours = 0; //Total Hours for the selection
					var submitted = 0; //Hours that are in status 20
					var approved = 0; //Hours that are in status 30
					var rejected = 0;
					var draft = 0; //Hours that are in status 10
					//No need to take care of records that were approved and changed 

					var oDateMap = {}; //Taking Date as primary key

					var extraHours = 0; //Extra hours if recorded in a week
					var timeRemaining = 0; //Hours left to be rlecorded in a week

					oData.forEach(function (element) {
						var oHours = {
							total: 0,
							target: 0
						};
						if ((parseFloat(element.HeaderData.target) < parseFloat(element.HeaderData.sum)))
						//If Target is less than recorded we are not considering upward and downward tolerence 

						{
							oHours.total = element.HeaderData.sum;
							oHours.target = element.HeaderData.target;
							oHours.extra = element.HeaderData.sum;

							oDateMap[element.HeaderData.date.getTime()] = oHours;
						} else {
							oHours.total = element.HeaderData.sum;
							oHours.target = element.HeaderData.target;
							oHours.extra = element.HeaderData.sum;

							oDateMap[element.HeaderData.date.getTime()] = oHours;

						}

						if (element.TimeEntryDataFields.STATUS === "20" && !liveChangeHours) //Submitted //If not invoked from l
						{
							submitted = submitted + parseFloat(element.TimeEntryDataFields.CATSHOURS);
						} else if ((element.TimeEntryDataFields.STATUS === "30" || element.TimeEntryDataFields.STATUS === "99") && !liveChangeHours) //Approved
						{
							approved = approved + parseFloat(element.TimeEntryDataFields.CATSHOURS);
						} else if (element.TimeEntryDataFields.STATUS === "40" && !liveChangeHours) //Rejected
						{
							rejected = rejected + parseFloat(element.TimeEntryDataFields.CATSHOURS);
						} else if (element.TimeEntryDataFields.STATUS === "10" && !liveChangeHours) //Draft
						{
							draft = draft + parseFloat(element.TimeEntryDataFields.CATSHOURS);
						}
					});

					weekSelectionData.forEach(function (element) {
						var oHours = {
							total: 0,
							target: 0,
							extra: 0
						};
						oHours.target = element.TargetHours;

						element.TimeEntries.results.forEach(function (element) {

							if (element.TimeEntryDataFields.STATUS === "20" && liveChangeHours) {
								submitted = submitted + parseFloat(element.TimeEntryDataFields.CATSHOURS);
							}

							if ((element.TimeEntryDataFields.STATUS === "30" || element.TimeEntryDataFields.STATUS === "99") && liveChangeHours) {
								approved = approved + parseFloat(element.TimeEntryDataFields.CATSHOURS);

							}
							if (element.TimeEntryDataFields.STATUS === "40" && liveChangeHours) {
								rejected = rejected + parseFloat(element.TimeEntryDataFields.CATSHOURS);

							}
							if (element.TimeEntryDataFields.STATUS === "10" && liveChangeHours) {
								draft = draft + parseFloat(element.TimeEntryDataFields.CATSHOURS);

							}

						});
					});

					//Getting target and total hours

					var hoursArray = $.map(oDateMap, function (val) {
						return val;
					});
					hoursArray.forEach(function (date, value) {
						totalHours = totalHours + parseFloat(date.total);
						targetHours = targetHours + parseFloat(date.target);
						extraHours = extraHours + parseFloat(date.extra);
					});

					if (targetHours > totalHours) //Remaining hours
					{
						timeRemaining = targetHours - totalHours;
						extraHours = 0;
					} else {
						extraHours = totalHours - targetHours;
						timeRemaining = 0;
					}

					//Fixing to 2 decimal places
					submitted = submitted.toFixed(2);
					targetHours = targetHours.toFixed(2);
					totalHours = totalHours.toFixed(2);
					extraHours = extraHours.toFixed(2);
					timeRemaining = timeRemaining.toFixed(2);
					draft = draft.toFixed(2);
					approved = approved.toFixed(2);
					rejected = rejected.toFixed(2);

					this.getView().getModel("TotalHours").setProperty("/TargetHours", targetHours);
					this.getView().getModel("TotalHours").setProperty(
						"/TotalHours", totalHours);
					//Generating tooltip text for the progress Indicator
					// var newLine = "\n";
					// var tooltipText =
					// 	`${newLine} Target Hours : ${targetHours}${newLine} Total Hours : ${totalHours}${newLine} Remaining Hours : ${timeRemaining}${newLine} Extra Hours : ${extraHours}${newLine} Draft Hours : ${draft}${newLine} Submitted Hours : ${submitted}${newLine} Approved Hours : ${approved}${newLine} Rejected Hours : ${rejected}${newLine}`;
					// this
					// 	.getView().getModel("TotalHours").setProperty("/ToolTipText", tooltipText);
					// this.byId("progressIndicator").setAggregation(
					// 	"tooltip", tooltipText);
					//Generating a quick view for the text
					var oQuickViewData = [{
						Label: this.getModel("i18n").getResourceBundle().getText('target'),
						Value: targetHours
					}, {
						Label: this.getModel("i18n").getResourceBundle().getText('recorded'),
						Value: totalHours

					}, {
						Label: this.getModel("i18n").getResourceBundle().getText('draft'),
						Value: draft
					}, {
						Label: this.getModel("i18n").getResourceBundle().getText('Submitted'),
						Value: submitted
					}, {
						Label: this.getModel("i18n").getResourceBundle().getText('Approved'),
						Value: approved
					}, {
						Label: this.getModel("i18n").getResourceBundle().getText('Rejected'),
						Value: rejected
					}];

					this.setModel(new JSONModel(oQuickViewData), "ProgressView");

				}
				var self = this;
				var id = "mProgressIndicator";
				if (self.getModel("controls").getProperty('/fixProgressIndicator')) {
					id = "progressIndicatorFixed";
				}

				this.getView().byId(id).addEventDelegate({
					onclick: function (oEvent) {
						var oDialog;
						if (oDialog) {
							oDialog.close();
						}
						var oDialogController = {
							handleClose: function (event) {
								oDialog.close();
							},
							showTooltip: function (Label, Value) {
								//return Label + "\n" + Value;
							},
							showToast: function (oEvent) {
								var oMessage = oEvent.getSource().getHeader() + "\n" + oEvent.getSource().getSubheader();
								sap.m.MessageToast.show(oMessage, {
									duration: 1000
								});

								oDialog.close();
							},

						};
						if (!oDialog) {
							oDialog = sap.ui.xmlfragment(self.getView().getId(), "hcm.fab.mytimesheet.view.fragments.ProgressIndicator",
								oDialogController);
							self.getView().addDependent(oDialog);
							// oDialog.bindElement('TimeData>' + oEvent.getSource().getBindingContext('TimeData').getPath());
						}

						// delay because addDependent will do a async rerendering and the popover will immediately close without it
						var oButton = oEvent.srcControl;
						jQuery.sap.delayedCall(0, self, function () {
							oDialog.openBy(oButton);
						});

					}
				});
			},

		handleFocusLinkClick: function (oEvent) {
			var self = this;
			var oDialog;
			if (oDialog) {
				oDialog.close();
			}
			var oDialogController = {
				handleClose: function (event) {
					oDialog.close();
				},
				showTooltip: function (Label, Value) {
					//	return Label + "\n" + Value;
				},
				showToast: function (oEvent) {
					var oMessage = oEvent.getSource().getHeader() + "\n" + oEvent.getSource().getSubheader();
					sap.m.MessageToast.show(oMessage, {
						duration: 1000,
						width: "10rem"
					});

					oDialog.close();
				},

			};
			if (!oDialog) {
				oDialog = sap.ui.xmlfragment(self.getView().getId(), "hcm.fab.mytimesheet.view.fragments.ProgressIndicator",
					oDialogController);
				self.getView().addDependent(oDialog);
				// oDialog.bindElement('TimeData>' + oEvent.getSource().getBindingContext('TimeData').getPath());
			}

			// delay because addDependent will do a async rerendering and the popover will immediately close without it
			var oButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, self, function () {
				oDialog.openBy(oButton);
			});

		},
		liveChangeHours: function (oEvent) {
			var val = /^\d+(\.\d{1,2})?$/;
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isOverviewChanged", false);
				this.getModel("controls").setProperty("/overviewDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isOverviewChanged", true);
				this.getModel("controls").setProperty("/overviewDataChanged", true);
			}
			this.successfulCheck = "";
			sap.ushell.Container.setDirtyFlag(true);
			// if (!isNaN(parseFloat(oEvent.getSource().getValue()))) {
			if (val.test(oEvent.getSource().getValue())) {
				var counter = oEvent.getSource().getParent().getParent().getCustomData('counter')[0].getValue();
				// var oModel = this.getModel('TimeData');
				var oModel = this.oTable.getModel('TimeData');
				var index = parseInt(oEvent.getSource().getParent().getParent().getBindingContext('TimeData').getPath().split('/')[1]);
				var data = oModel.getData();
				if (counter && counter !== null) {
					data[index].TimeEntryOperation = 'U';
					data[index].TimeEntryDataFields.CATSHOURS = parseFloat(oEvent.getSource().getValue()).toFixed(2);
				} else {
					data[index].TimeEntryOperation = 'C';
					data[index].TimeEntryDataFields.CATSHOURS = parseFloat(oEvent.getSource().getValue()).toFixed(2);
				}
				data = this.calculateSum(new Date(data[index].TimeEntryDataFields.WORKDATE), data);
				oModel.refresh();
			}

			this.getEnteredHours(true);

		},
		liveChangeAdHoc: function (oEvent) {
			var val = /^\d+(\.\d{1,2})?$/;
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isOverviewChanged", false);
				this.getModel("controls").setProperty("/overviewDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isOverviewChanged", true);
				this.getModel("controls").setProperty("/overviewDataChanged", true);
			}
			var valIndex = this.getModel("controls").getProperty("/index");

			this.successfulCheck = "";
			//var oData = this.getModel('adHocTimeData').getData();

			// oData = $.extend(true, [], oData);

			sap.ushell.Container.setDirtyFlag(true);
			// if (!isNaN(parseFloat(oEvent.getSource().getValue()))) {
			if (val.test(oEvent.getSource().getValue())) {
				var counter = this.getModel('controls').getProperty("/adHocCounter");
				// var oModel = this.getModel('TimeData');
				var oModel = this.oTable.getModel('TimeData');
				//Two way data binding won't work if we use custom formatters so we have to set it manually when action is performed
				var customData = oEvent.getSource().getCustomData('GroupPosition')[0].getValue();
				customData.FieldValue = parseFloat(oEvent.getSource().getValue());

				var index = valIndex;
				var data = oModel.getData();
				if (counter && counter !== null) {
					data[index].TimeEntryOperation = 'U';
					data[index].TimeEntryDataFields.CATSHOURS = parseFloat(oEvent.getSource().getValue()).toFixed(2);
					this.getModel('controls').setProperty('/adHocUpdate', true);
					this.getModel('controls').setProperty('/adHocCreate', false);
				} else {
					data[index].TimeEntryOperation = 'C';
					data[index].TimeEntryDataFields.CATSHOURS = parseFloat(oEvent.getSource().getValue()).toFixed(2);
					this.getModel('controls').setProperty('/adHocUpdate', false);
					this.getModel('controls').setProperty('/adHocCreate', true);
				}
				data = this.calculateSum(new Date(data[index].TimeEntryDataFields.WORKDATE), data);
				oModel.refresh();
				var totalTargetData = this.getModel('adHocTotalTarget').getData();
				totalTargetData[0].recorded = data[index].totalHours;
				for (var i = 1; i < totalTargetData.length; i++) {
					totalTargetData[i].updated = parseFloat(oEvent.getSource().getValue()).toFixed(2);
				}
				this.getModel('adHocTotalTarget').refresh();
			}
			//Updating total target model for live change

			this.getModel('controls').setProperty('/total', data[index].HeaderData.target);
			this.getModel('controls').setProperty('/recorded', data[index].HeaderData.sum);
			this.getEnteredHours(true);
		},

		checkTimeEntry: function (oSource, oAssignmentId, hours, starttime, endtime, workdate, counter) {
			var that = this;
			var obj = null;
			if (counter && counter !== null) {
				obj = {
					'AssignmentId': oAssignmentId,
					'CatsHours': hours,
					'Counter': counter,
					'EndTime': endtime,
					'Operation': "U",
					'StartTime': starttime,
					'WorkDate': workdate
				};
			} else {
				obj = {
					'AssignmentId': oAssignmentId,
					'CatsHours': hours,
					'Counter': counter,
					'EndTime': endtime,
					'Operation': "C",
					'StartTime': starttime,
					'WorkDate': workdate
				};
			}
			var mParameters = {
				// urlParameters: 'AssignmentId='+oAssignmentId+'&CatsHours='+hours+'m&Counter='+counter+'&EndTime='+endtime+'&Operation=C&StartTime='+starttime+'&WorkDate=datetime'+"'"+workdate"'",
				urlParameters: obj,
				success: function (oData, oResponse) {
					if (oData.results.length >= 1) {
						oSource.setValueState("Warning");
						oSource.setValueStateText(oData.results[0].Text);

					}

				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.callFunction('/CheckTimesheet', mParameters);
		},
		calculateChangeCount: function () {
			var data = this.getModel('TimeData').getData();
			var controls = this.getModel('controls').getData();
			var newRecords = $.grep(data, function (element, index) {
				return element.TimeEntryOperation == 'C';
			});
			var updateRecords = $.grep(data, function (element, index) {
				return element.TimeEntryOperation == 'U';
			});
			var selectedRecords = $.grep(data, function (element, index) {
				return element.TimeEntryOperation == 'R';
			});
			if (selectedRecords.length > 0) {
				controls.numberOfRecords = selectedRecords.length;
			} else {
				controls.numberOfRecords = newRecords.length + updateRecords.length;
			}
			this.getModel('controls').setData(controls);
		},
		calculateSum: function (oDate, data) {
			var that = this;
			var sum = parseFloat(0);
			oDate = this.oFormatyyyymmdd.format(oDate);
			var element = $.grep(data, function (element, index) {
				return that.oFormatyyyymmdd.format(new Date(element.TimeEntryDataFields.WORKDATE)) == oDate;
			});
			for (var i = 0; i < element.length; i++) {
				if (element[i].TimeEntryDataFields.STATUS !== '40') {
					sum = (parseFloat(sum) + parseFloat(element[i].TimeEntryDataFields.CATSHOURS)).toFixed(2);
				}
			}
			for (var j = 0; j < data.length; j++) {
				if (that.oFormatyyyymmdd.format(new Date(data[j].TimeEntryDataFields.WORKDATE)) === oDate) {
					data[j].totalHours = sum;
					data[j].HeaderData.sum = sum;
				}
			}

			return data;

		},
		calculateSumToDo: function (oDate, data) {
			var that = this;
			var sum = parseFloat(0);
			oDate = this.oFormatyyyymmdd.format(oDate);
			var element = $.grep(data, function (element, index) {
				return that.oFormatyyyymmdd.format(new Date(element.TimeEntryDataFields.WORKDATE)) == oDate;
			});
			var total = ((parseFloat(element[0].target) - parseFloat(element[0].missing))).toFixed(2);
			for (var i = 0; i < element.length; i++) {
				if (element[i].TimeEntryDataFields.STATUS !== '10' && element[i].TimeEntryDataFields.STATUS !== '40') {
					sum = (parseFloat(sum) + parseFloat(element[i].TimeEntryDataFields.CATSHOURS)).toFixed(2);
				} else if ((element[i].TimeEntryDataFields.STATUS === '10' || element[i].TimeEntryDataFields.STATUS === '40') && element[i].addButtonEnable ===
					true) {
					sum = (parseFloat(sum) + parseFloat(element[i].TimeEntryDataFields.CATSHOURS)).toFixed(2);
				}
			}
			for (var j = 0; j < data.length; j++) {
				if (that.oFormatyyyymmdd.format(new Date(data[j].TimeEntryDataFields.WORKDATE)) === oDate) {
					data[j].total = (parseFloat(sum) + parseFloat(total)).toFixed(2);
					data[j].currentMissing = ((parseFloat(data[j].target)) - parseFloat(data[j].total)) < 0 ? parseFloat(0).toFixed(2) : ((
						parseFloat(
							data[j].target)) - parseFloat(data[j].total)).toFixed(2);
				}
			}
			return data;

		},
		resetAdHocControls: function () {
			var oControl = this.getModel('controls');
			oControl.setProperty("/intervalSelection", false);
			oControl.setProperty("/singleSelection", true);
			oControl.setProperty("/currentAdHoc", false);
			oControl.setProperty("/adHocUpdate", false);
			oControl.setProperty('/adHocCreate', false);
			oControl.setProperty('/isOlderMultipleDays', false);
			this.setModel(new JSONModel([]), "adHocCreateCopy");
			this.adHocDemandEntries = {};
			this.setModel(new JSONModel({
				assignmentName: "",
				validFrom: null,
				validTo: null,
				status: true,
				withClock: false

			}), "adHocSaveAssignmentModel");
		},
		resetTodoAdHocControls: function () {
			var oControl = this.getModel('controls');
			oControl.setProperty("/currentTodoAdHoc", false);
			oControl.setProperty("/adHocTodoUpdate", false);
			oControl.setProperty('/adHoc|TodoCreate', false);
			oControl.setProperty('/isOlderMultipleDays', false);
			this.setModel(new JSONModel([]), "adHocCreateCopy");
			this.adHocDemandEntries = {};
			this.setModel(new JSONModel({
				assignmentName: "",
				validFrom: null,
				validTo: null,
				status: true,
				withClock: false

			}), "adHocSaveAssignmentModel");
		},
		onCancel: function () {
			var that = this;
			var oControl = this.getModel('controls');
			this.getView().byId("filterCombo").setSelectedKey("100");
			oControl.setProperty('/duplicateVisibility', false);
			oControl.setProperty('/duplicateWeekVisibility', false);
			oControl.setProperty('/overviewEdit', true);
			oControl.setProperty('/onEdit', "None");
			//Handling display of Check, Submit and Cancel button
			oControl.setProperty("/sendForApprovalCheck", false);
			oControl.setProperty("/sendForApproval", false);
			oControl.setProperty("/overviewCancel", false);
			if (!sap.ui.Device.system.phone) {
				oControl.setProperty("/showFooter", false);
			}
			if (that.checkButtonNeeded === "X") {
				oControl.setProperty('/overviewDataChangedWithCheck', false);
			}
			if (oControl.getProperty('/currentAdHoc')) {
				//Replacing data with old value
				this.getModel('TimeData').getData()[oControl.getProperty('/index')] = this.getModel('oldEntry').getData();
				try {
					if (sap.ui.Device.system.phone == true) {
						// this.mCalendar.setStartDate(new Date(this.startdate));
					} else {
						var firstMonth = this.firstMonthOfCalendar;
						if (this.isLastWeek) {
							var now = new Date(this.startdate);
							if (now.getMonth() == 11) {
								var current = new Date(now.getFullYear() + 1, 0, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() > that.maxFocusDate.getTime()) {
									this.calendar.focusDate(that.maxFocusDate);
								} else {
									this.calendar.focusDate(current);
								}
							} else {
								var current = new Date(now.getFullYear(), now.getMonth() + 1, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() > that.maxFocusDate.getTime()) {
									this.calendar.focusDate(that.maxFocusDate);
								} else {
									this.calendar.focusDate(current);
								}
							}

						} else {
							this.calendar.focusDate(this.startdate);

						}
						if (this.firstMonthOfCalendar === (this.calendar.getStartDate().getMonth() + 1) % 12) {
							var now = new Date(this.startdate);
							if (now.getMonth() == 11) {
								var current = new Date(now.getFullYear() + 1, 0, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() > that.maxFocusDate.getTime()) {
									this.calendar.focusDate(that.minFocusDate);
								} else {
									this.calendar.focusDate(current);
								}
							} else {
								var current = new Date(now.getFullYear(), now.getMonth() + 1, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() > that.maxFocusDate.getTime()) {
									this.calendar.focusDate(that.minFocusDate);
								} else {
									this.calendar.focusDate(current);
								}
							}
						} else if ((this.firstMonthOfCalendar + 1) % 12 === (this.calendar.getStartDate().getMonth())) {
							var now = new Date(this.startdate);
							if (now.getMonth() == 0) {
								var current = new Date(now.getFullYear() - 1, 12, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() < that.minFocusDate.getTime()) {
									this.calendar.focusDate(that.minFocusDate);
								} else {
									this.calendar.focusDate(current);
								}

							} else {
								var current = new Date(now.getFullYear(), now.getMonth() - 1, 1);
								current.setHours(0, 0, 0, 0);
								if (current.getTime() < that.minFocusDate.getTime()) {
									this.calendar.focusDate(that.minFocusDate);
								} else {
									this.calendar.focusDate(current);
								}
							}
						}

					}
				} catch (e) {

				}

			}
			oControl.setProperty("/intervalSelection", false);
			oControl.setProperty("/singleSelection", true);
			oControl.setProperty("/currentAdHoc", false);
			oControl.setProperty("/adHocUpdate", false);
			oControl.setProperty('/adHocCreate', false);
			oControl.setProperty('/isOlderMultipleDays', false);

			this.setModel(new JSONModel({
				assignmentName: "",
				validFrom: null,
				validTo: null,
				status: true,
				withClock: false

			}), "adHocSaveAssignmentModel");
			this.getModel("adHocSaveAssignmentModel").refresh();
			that.adHocSelectedDates = null;
			oControl.setProperty('/index', -1);
			oControl.setProperty('/recorded', 0);
			oControl.setProperty('/target', 0);
			that.setModel(new JSONModel([]), "adHocCreateCopy");
			oControl.setProperty('/overviewDataChanged', false);
			oControl.setProperty('/isOverviewChanged', false);
			sap.ushell.Container.setDirtyFlag(false);
			that.bindTable(new Date(that.startdate), new Date(that.enddate));

			// this.rebindTable(this.oReadOnlyTemplate, "Navigation");
			try {
				this.calendarSelection(this.calendar, new Date(this.startdate), new Date(this.enddate));
			} catch (e) {

			}
			this.rebindTableWithTemplate(this.oTable, "TimeData>/", this.oReadOnlyTemplate, "Navigation");
			this.getEnteredHours(false);
			oControl.setProperty("/duplicateScreen", false);
			var data = {};
			var oModel = new JSONModel();
			oModel.setData(data);
			this.setModel(oModel, 'deleteRecords');
			this.setModel(oModel, 'changedRecords');
			this.setModel(oModel, 'newRecords');
			this.setModel(oControl, "controls");
			sap.ui.getCore().getMessageManager().removeAllMessages();
			// this.rebindTable(this.readTemplate, "Navigation");
		},
		onTodoCancel: function () {
			var oControl = this.getModel('controls');
			// oControl.setProperty('/todoCancel', false);
			// oControl.setProperty('/todoDone', false);
			oControl.setProperty('/editTodoVisibility', true);
			//Handling display of Check, Submit and Cancel button
			oControl.setProperty("/todoDoneCheck", false);
			oControl.setProperty("/todoDone", false);
			oControl.setProperty("/todoCancel", false);
			this.resetTodoAdHocControls();
			this.setModel(new JSONModel({
				assignmentName: "",
				validFrom: null,
				validTo: null,
				status: true,
				withClock: false

			}), "adHocSaveAssignmentModel");
			this.getModel("adHocSaveAssignmentModel").refresh();

			if (!sap.ui.Device.system.phone) {
				oControl.setProperty('/showFooter', false);
			}
			var oModel = new JSONModel($.extend(true, [], this.todolist));
			this.setModel(oModel, "TodoList");
			if (this.oReadOnlyToDoTemplate) {
				this.rebindTableWithTemplate(this.oToDoTable, "TodoList>/", this.oReadOnlyToDoTemplate, "Navigation");
			}
			sap.ui.getCore().getMessageManager().removeAllMessages();
		},
		rebindTable: function (oTemplate, sKeyboardMode) {
			this.oTable.bindItems({
				path: "TimeData>/",
				template: oTemplate,

				templateShareable: true
			}).setKeyboardMode(sKeyboardMode);
		},
		rebindTableWithTemplate: function (oTable, sPath, oTemplate, sKeyboardMode) {
			if (sPath === 'TimeData>/' && sap.ui.Device.system.phone === false) {
				oTable.bindItems({
					path: sPath,
					sorter: [new sap.ui.model.Sorter("HeaderData", false, true, this.compareRows)],
					template: oTemplate,
					key: "overviewBind",
					templateShareable: true,
					groupHeaderFactory: this.getGroupHeader.bind(this)
				}).setKeyboardMode(sKeyboardMode);
			} else if (sPath === 'TimeData>/' && sap.ui.Device.system.phone === true) {
				oTable.bindItems({
					path: sPath,
					key: "mobileBind",
					sorter: [new sap.ui.model.Sorter("TimeEntryDataFields/WORKDATE", false, false)
						// , new sap.ui.model.Sorter(
						// 	"TimeEntryDataFields/CATSHOURS", true, false)
					],
					template: oTemplate,
					templateShareable: true,
					// groupHeaderFactory: this.getGroupHeader
				}).setKeyboardMode(sKeyboardMode);
			} else if (sPath === 'TodoList>/') {
				oTable.bindItems({
					path: sPath,
					key: "todoBind",
					template: oTemplate,
					templateShareable: true
				}).setKeyboardMode(sKeyboardMode);
			}
		},
		compareRowsAdHoc: function (a, b) {
			if (new Date(a.date) > new Date(b.date)) {
				return 1;
			} else if (new Date(b.date) > new Date(a.date)) {
				return -1;
			} else {
				if (a.addButton == true && b.addButton == true) {
					return 0;
				} else if (b.addButton == true) {
					return -1;
				} else if (a.addButton == true) {
					return 1;
				}
			}
			return 0;
		},
		compareRows: function (a, b) {
			if (new Date(a.date) > new Date(b.date)) {
				return 1;
			} else if (new Date(b.date) > new Date(a.date)) {
				return -1;
			} else {
				if (a.addButton == true && b.addButton == true) {
					return 0;
				} else if (b.addButton == true) {
					return -1;
				} else if (a.addButton == true) {
					return 1;
				} else if (a.highlight == true && b.highlight == true) {
					return 0;
				} else if (a.highlight == true) {
					return 1;
				} else if (b.highlight == true) {
					return -1;
				}
			}
		},

		loadTasks: function () {
			return new sap.ui.core.Item({
				key: "{Tasks>AssignmentName}",
				text: "{Tasks>AssignmentName}"
			});
		},
		createGroupingOfFields: function (formContainers, oField) {

			for (var index = 0; index < formContainers.length; index++) {
				var element1 = formContainers[index];
				var fieldData = {
					containers: [],
					GroupPosition: "",
					GroupName: "",
					AdditionHelp: ""

				};
				var fieldData2 = {
					containers: [],
					GroupPosition: "",
					GroupName: "",
					AdditionHelp: ""
				};

				if (element1.form[0].GroupPosition === undefined) { //In Case of Switch
					//Atleast one field should come 
					oField.fields[oField.fields.length - 1].containers.push({
						form: [element1.form[0]]
					});
					oField.fields[oField.fields.length - 1].visible = 'false';
					continue;
				}
				if (index + 1 !== formContainers.length) {

					if (element1.form[0].GroupPosition === formContainers[index + 1].form[0].GroupPosition) {
						//Part of same group
						if (oField.fields.length === 0) {
							fieldData.containers.push({
								form: [element1.form[0]]
							});
							oField.fields.push({
								containers: fieldData.containers,
								GroupPosition: fieldData.GroupPosition,
								GroupName: fieldData.GroupName,
								AdditionHelp: fieldData.AdditionHelp
							});

						} else {
							oField.fields[oField.fields.length - 1].containers.push({
								form: [element1.form[0]]
							});
						}
						oField.fields[oField.fields.length - 1].GroupPosition = element1.form[0].GroupPosition;
						oField.fields[oField.fields.length - 1].GroupName = element1.form[0].GroupName;
						oField.fields[oField.fields.length - 1].AdditionHelp = element1.form[0].AdditionHelp;

					} else {
						if (oField.fields.length === 0) {
							fieldData.containers.push({
								form: [element1.form[0]]
							});
							oField.fields.push({
								containers: fieldData.containers,
								GroupPosition: fieldData.GroupPosition,
								GroupName: fieldData.GroupName,
								AdditionHelp: fieldData.AdditionHelp
							});

							oField.fields[oField.fields.length - 1].GroupPosition = element1.form[0].GroupPosition;
							oField.fields[oField.fields.length - 1].GroupName = element1.form[0].GroupName;
							oField.fields[oField.fields.length - 1].AdditionHelp = element1.form[0].AdditionHelp;

							oField.fields.push({
								containers: fieldData2.containers,
								GroupPosition: fieldData2.GroupPosition,
								GroupName: fieldData2.GroupName,
								AdditionHelp: fieldData2.AdditionHelp
							});

						} else {
							oField.fields[oField.fields.length - 1].containers.push({
								form: [element1.form[0]]
							});
							oField.fields[oField.fields.length - 1].GroupPosition = element1.form[0].GroupPosition;
							oField.fields[oField.fields.length - 1].GroupName = element1.form[0].GroupName;
							oField.fields[oField.fields.length - 1].AdditionHelp = element1.form[0].AdditionHelp;
							oField.fields.push({
								containers: fieldData2.containers,
								GroupPosition: fieldData2.GroupPosition,
								GroupName: fieldData2.GroupName,
								AdditionHelp: fieldData2.AdditionHelp
							});
						}

					}
				} else {
					if (oField.fields.length === 0) {
						fieldData.containers.push({
							form: [element1.form[0]]
						});

						oField.fields.push({
							containers: fieldData.containers,
							GroupPosition: fieldData.GroupPosition,
							GroupName: fieldData.GroupName,
							AdditionHelp: fieldData.AdditionHelp
						});
						oField.fields[oField.fields.length - 1].GroupPosition = element1.form[0].GroupPosition;
						oField.fields[oField.fields.length - 1].GroupName = element1.form[0].GroupName;
						oField.fields[oField.fields.length - 1].AdditionHelp = element1.form[0].AdditionHelp;

					} else {
						oField.fields[oField.fields.length - 1].containers.push({
							form: [element1.form[0]]
						});
						oField.fields[oField.fields.length - 1].GroupPosition = element1.form[0].GroupPosition;
						oField.fields[oField.fields.length - 1].GroupName = element1.form[0].GroupName;
						oField.fields[oField.fields.length - 1].AdditionHelp = element1.form[0].AdditionHelp;
					}

				}

			}

			// oField.pop();
			//Now iterating on each field and checking for container size as 1
			for (var i = 0; i < oField.fields.length; i++) {
				//If group has only one field	

				if (oField.fields[i].containers.length === 1 && !sap.ui.Device.system.phone) {
					//create a deep copy of an objecy
					var obj = JSON.parse(JSON.stringify(oField.fields[i].containers[0]));
					obj.form[0].DefaultValue = "";
					obj.form[0].DispValueText = "";
					obj.form[0].FieldLabel = "";
					obj.form[0].FieldType = "$";
					obj.form[0].FieldValue = '';
					obj.form[0].HasF4 = "";
					obj.form[0].IsReadOnly = "";
					obj.form[0].valueState = "None";
					obj.form[0].valueStateText = "";
					obj.form[0].dummy = "true";
					obj.form[0].Required = "";
					obj.form[0].FieldName = "";

					oField.fields[i].containers.push(obj);

				}
				//If groupName is empty
				if (oField.fields[i].GroupName === "") {

					oField.fields[i].GroupName = this.getModel("i18n").getResourceBundle().getText('defaultFieldGroupName');
				}
			}

		},

		onTaskCreate: function (oEvent) {
			var that = this;
			that.byId("idTasks").setBusy(true);
			var oView = this.getView();
			var formElements = [];
			var formContainers = [];
			var form = {
				name: null,
				status: false,
				containers: null
			};
			var oControl = this.getModel("controls");
			oControl.setProperty('/createAssignment', true);
			oControl.setProperty('/editAssignment', false);
			oControl.setProperty('/copyAssignment', false);
			oControl.setProperty('/displayAssignment', false);
			oControl.setProperty('/editAssignmentCancel', true);
			oControl.setProperty('/displayAssignmentCancel', false);
			oControl.setProperty('/assignmentTitle', this.oBundle.getText("createAssignment"));
			this.setGlobalModel(oControl, "controls");
			this.setGlobalModel(oControl, "controls");
			// var selectedTask = oTable.getSelectedItem().getAggregation('cells');
			var profileFields = $.extend(true, [], this.getModel('ProfileFields').getData());

			var oModel = new JSONModel();
			for (var i = 0; i < profileFields.length; i++) {
				// var obj = $.grep(data, function(element, index) {
				// 	return element.FieldName == selectedTask[i].getCustomData('FieldName')[0].getValue();
				// });
				if (profileFields[i].FieldValue === true) {
					profileFields[i].FieldValue = false;
				} else {
					profileFields[i].FieldValue = "";
				}
				if (profileFields[i].FieldName !== "AssignmentName" && profileFields[i].FieldName !== "ValidityStartDate" && profileFields[i].FieldName !==
					"ValidityEndDate") {
					formElements.push(profileFields[i]);
					profileFields[i].valueState = "None";
					profileFields[i].valueStateText = "";

				}
				if (formElements.length >= 1) {
					formContainers.push({
						form: $.extend(formElements, [], true)
					});
					formElements = [];
				}
			}
			form.containers = formContainers;
			var oField = {
				fields: [],
				name: null,
				status: false

			};
			// form.formElements = formElements;
			oModel.setData(form);
			this.setGlobalModel(oModel, "EditedTask");
			this.createGroupingOfFields(formContainers, oField);

			this.setGlobalModel(new JSONModel(oField), "EditedTask1");

			that.byId(
				"idTasks").setBusy(false);
			this.getRouter().navTo("editAssignment", {}, false);
		},
		//delete confirmation added 
		// Note 2890326 Starts
		onTaskDeleteConfirm: function (oEvent) {
			var that = this;
			var messageHeader = "";
			var oTable = this.byId('idTasks');
			var data = this.getModel('Tasks').getData();
			var selectedItems = oTable.getSelectedItems();
			var flag = false; //Having assignment group
			for (var i = 0; i < selectedItems.length; i++) {
				var index = selectedItems[i].getBindingContext('TaskFields').getPath().split("/")[1];
				if (data[index].ToGrps.results.length > 0) //Assignment is part of an assignment group
				{
					flag = true;
					break;
				}
			}
			if (flag === true && selectedItems.length === 1) //If Single Assignment and that is a part of group
			{
				messageHeader = that.oBundle.getText("confirmationDeleteAssignmentWithGroup");
			} else if (flag === true && selectedItems.length > 1) //If Multiple Assignment and is part of group
			{
				messageHeader = that.oBundle.getText("confirmationDeletionManyAssignmentWithGroup");
			} else //No assignment that is part of assignment Group
			{
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

		//Note 2890326 Ends
		onTaskDelete: function (oEvent) {
			var that = this;
			this.showBusy();
			var oTable = this.byId('idTasks');
			var data = this.getModel('Tasks').getData();
			var selectedItems = oTable.getSelectedItems();
			var deleteEntries = [];
			for (var i = 0; i < selectedItems.length; i++) {
				var selectedTask = selectedItems[i].getAggregation('cells');
				var AssignmentId = selectedTask[0].getAggregation('customData')[1].getValue();
				var index = selectedItems[i].getBindingContext('TaskFields').getPath().split("/")[1];
				delete data[index].ToGrps;
				data[index].ValidityStartDate = this.oFormatYyyymmdd.format(new Date(data[index].ValidityStartDate)) + "T00:00:00";
				data[index].ValidityEndDate = this.oFormatYyyymmdd.format(new Date(data[index].ValidityEndDate)) + "T00:00:00";
				var oData = $.extend(true, {}, data[index]);
				oData.AssignmentOperation = "D";
				deleteEntries.push(oData);
			}
			var oModel = $.extend(true, {}, this.oDataModel);
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
					function (oData) {
						for (var i = 0; i < deleteEntries.length; i++) {
							var obj = {
								properties: deleteEntries[i],
								changeSetId: "TimeEntry",
								groupId: "TimeEntry"
							};
							oModel
								.createEntry(
									that.appendLocaleParameter("/AssignmentCollection"),
									obj);
						}
						oModel.submitChanges({
							groupId: "TimeEntry",
							changeSetId: "TimeEntry",
							success: function (oData, res) {
								if (!oData.__batchResponses[0].__changeResponses) {
									// for (var i=0; i<that.batches.length;i++){
									// 	that.batches[i].TimeEntryDataFields.WORKDATE = new Date(that.batches[i].TimeEntryDataFields.WORKDATE);
									// }
									that.hideBusy(true);
									return;
								}
								if (oData.__batchResponses[0].__changeResponses.length > 1) {
									var toastMsg = that.oBundle.getText("assignmentsDeletedSuccessfully");
								} else {
									var toastMsg = that.oBundle.getText("assignmentDeletedSuccessfully");
								}
								//var toastMsg = that.oBundle.getText("assignmentDeletedSuccessfully");
								sap.m.MessageToast.show(toastMsg, {
									duration: 1000
								});
								if (that.filterDateFrom !== "") {
									that.getTasks(false, that.filterDateFrom, that.filterDateTo, true);
								} else {
									that.getTasks(false, that.minNavDate, that.maxNavDate);
								}
								that.hideBusy(true);

							},
							error: function (oError) {
								that.hideBusy(true);
								that.oErrorHandler.processError(oError);
							}
						});

					}, true);
			that.hideBusy(true);
		},

		onTaskEdit: function (oEvent) {
			var that = this;
			that.byId("idTasks").setBusy(true);
			var oView = this.getView();
			var oTable = this.byId('idTasks');
			var oModel = new JSONModel();
			var data = this.getModel('ProfileFields').getData();
			var tasks = this.getModel('Tasks').getData();
			var index = oTable.getSelectedItem().getBindingContext('TaskFields').getPath().split("/")[1];
			var formElements = [];
			var formContainers = [];
			var form = {
				name: null,
				status: false,
				containers: null
			};
			var oControl = this.getModel("controls");
			oControl.setProperty('/createAssignment', false);
			oControl.setProperty('/editAssignment', true);
			oControl.setProperty('/editAssignmentCancel', true);
			oControl.setProperty('/displayAssignment', false);
			oControl.setProperty('/displayAssignmentCancel', false);
			oControl.setProperty('/copyAssignment', false);
			oControl.setProperty('/assignmentTitle', this.oBundle.getText("editAssignment"));
			this.setGlobalModel(oControl, "controls");
			var selectedTask = oTable.getSelectedItem().getAggregation('cells');
			var profileFields = $.extend(true, [], this.getModel('ProfileFields').getData());
			for (var i = 0; i < selectedTask.length; i++) {
				var obj = $.grep(data, function (element, index) {
					return element.FieldName == selectedTask[i].getCustomData('FieldName')[0].getValue();
				});
				if (selectedTask[i].getCustomData('FieldName')[0].getValue() !== "AssignmentStatus" && selectedTask[i].getCustomData(
						'FieldName')[
						0].getValue() !== "AssignmentName" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityStartDate" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityEndDate") {
					if (tasks[index].AssignmentFields[selectedTask[i].getCustomData('FieldName')[0].getValue()] !== undefined) {
						obj[0].FieldValue = tasks[index].AssignmentFields[selectedTask[i].getCustomData('FieldName')[0].getValue()];
					}
					obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
				} else {
					if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentStatus") {
						obj[0].FieldValue = selectedTask[i].getAggregation('customData')[2].getValue();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentName") {
						obj[0].FieldValue = selectedTask[i].getText();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityStartDate") {
						obj[0].FieldValue = selectedTask[i].getText();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityEndDate") {
						obj[0].FieldValue = selectedTask[i].getText();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					}
				}
				if (selectedTask[i].getCustomData('FieldName')[0].getValue() !== "AssignmentName" && selectedTask[i].getCustomData('FieldName')[
						0]
					.getValue() !== "AssignmentStatus" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityStartDate" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityEndDate") {
					formElements.push(obj[0]);
				} else {
					if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentName") {
						form.name = obj[0].FieldValue;
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentStatus") {
						form.status = obj[0].FieldValue;
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityStartDate") {
						form.validFrom = new Date(obj[0].FieldValue);
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityEndDate") {
						form.validTo = new Date(obj[0].FieldValue);
					}
				}
				if (formElements.length >= 1) {
					formContainers.push({
						form: $.extend(formElements, [], true)
					});
					formElements = [];
				}
			}
			// 				profileFields[i].AdditionHelp = "Additional Help" + "";
			form.containers = formContainers;
			var oField = {
				fields: [],
				name: null,
				status: false

			};
			// form.formElements = formElements;
			oModel.setData(form);
			this.setGlobalModel(oModel, "EditedTask");
			this.createGroupingOfFields(formContainers, oField);
			this.setGlobalModel(new JSONModel(oField), "EditedTask1");

			that.byId("idTasks").setBusy(false);
			this.getRouter().navTo("editAssignment", {}, false);
		},

		onTaskSelection: function (oEvent) {
			var oControl = this.getModel("controls");
			// var oSelectedItems = oEvent.getParameter("selectedContexts");
			if (oEvent.getParameters().listItem.getSelected() === true && this.oTaskTable.getSelectedItems().length == 1) {
				oControl.setProperty("/taskEdit", true);
				oControl.setProperty("/taskDelete", true);
				oControl.setProperty("/taskCopy", true);
				oControl.setProperty("/createGroupButton", true);
			} else if (this.oTaskTable.getSelectedItems().length == 1) {
				oControl.setProperty("/taskEdit", true);
				oControl.setProperty("/taskDelete", true);
				oControl.setProperty("/taskCopy", true);
				oControl.setProperty("/createGroupButton", true);
			} else {
				oControl.setProperty("/taskEdit", false);
				if (this.oTaskTable.getSelectedItems().length > 1) {
					oControl.setProperty("/taskDelete", true);
				} else {
					oControl.setProperty("/taskDelete", false);
				}
				oControl.setProperty("/taskCopy", false);
				oControl.setProperty("/createGroupButton", true);
			}
		},

		deleteSelectedDays: function (oEvent) {
			var index = oEvent.getParameters().listItem.getBindingContext('selectedDatesDup').getPath().split('/selectedDates/')[1];
			var data = this.getModel('selectedDatesDup').getData();
			// this.byId("duplicateCalendar").removeSelectedDate(new sap.ui.unified.DateRange({startDate:data.selectedDates[index].Date}));
			// this.byId("mDuplicateCalendar").removeSelectedDate(new sap.ui.unified.DateRange({startDate:data.selectedDates[index].Date}));
			this.byId("duplicateCalendar").removeAllSelectedDates();
			this.byId("mDuplicateCalendar").removeAllSelectedDates();
			delete data.selectedDates[index].Date;
			data.selectedDates.splice(index, 1);
			for (var i = 0; i < data.selectedDates.length; i++) {
				this.byId("duplicateCalendar").addSelectedDate(new sap.ui.unified.DateRange({
					startDate: data.selectedDates[i].Date
				}));
				this.byId("mDuplicateCalendar").addSelectedDate(new sap.ui.unified.DateRange({
					startDate: data.selectedDates[i].Date
				}));
			}
			var oModel = new JSONModel(data);
			this.setModel(oModel, 'selectedDatesDup');
			if (this.getModel("selectedDatesDup")) {
				if (this.getModel("selectedDatesDup").getData().selectedDates.length >= 1 &&
					this.getModel("TimeDataDuplicateTask").getData().length >= 1) {
					this.getModel("controls").setProperty("/duplicateTaskButtonEnable", true);
				} else {
					this.getModel("controls").setProperty("/duplicateTaskButtonEnable", false);
				}
			}
		},
		onDuplicateTask: function (oEvent) {
			var that = this;
			var oView = this.getView();
			var oTable = this.byId('idTasks');
			var oModel = new JSONModel();
			var oDialog;
			var oDialogController = {
				handleCancel: function () {
					oDialog.close();
					oDialog.destroy();
					this.setModel(new JSONModel({
						selectedDates: []
					}), "selectedDatesDup");
					this.setModel(new JSONModel([]), "TimeDataDuplicateTask");
					this.getModel("controls").setProperty("/duplicateTaskButtonEnable", false);
				}.bind(this),
				onSelect: this.handleDupTaskCalendarSelect.bind(this),
				onDelete: this.deleteSelectedDays.bind(this),
				onOverviewSelect: this.onOverviewSelectDup.bind(this),
				formatter: that.formatter,
				formatterStatus: that.formatter.status.bind(that),
				formatterGetDuplicatetTaskEnabled: that.formatter.getDuplicatetTaskEnabled.bind(that),
				formatterAssignmentName: that.formatter.assignmentName.bind(that),
				formatterFormatDuplicateText: that.formatter.formatDuplicateText.bind(that),
				handleConfirm: function () {
					var sucess = this.handleDuplicateTaskConfirm();
					if (sucess === "HrRecord") {
						var toastMsg = that.oBundle.getText("hrRecordNotDuplicated");
						sap.m.MessageToast.show(toastMsg, {
							duration: 3000
						});
					}
					if (sucess === true) {
						oDialog.close();
						oDialog.destroy();
						this.calendar.removeAllSelectedDates();
						this.setModel(new JSONModel({
							selectedDates: []
						}), "selectedDatesDup");
						this.setModel(new JSONModel([]), "TimeDataDuplicateTask");
						var toastMsg = that.oBundle.getText("duplicatedSuccessfully");
						sap.m.MessageToast.show(toastMsg, {
							duration: 3000
						});
						if (this.checkButtonNeeded === "X") {
							this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
							this.getModel("controls").setProperty("/isOverviewChanged", false);
							this.getModel("controls").setProperty("/overviewDataChanged", false);
						} else {
							this.getModel("controls").setProperty("/isOverviewChanged", true);
							this.getModel("controls").setProperty("/overviewDataChanged", true);
						}
						this.successfulCheck = "";
						this.successfulCheck = "";
						this.resetAdHocControls();
						this.resetTodoAdHocControls();

						this.getModel('controls').setProperty('/isOlderMultipleDays', true);
						sap.ushell.Container.setDirtyFlag(true);
						this.getModel("controls").setProperty("/duplicateTaskButtonEnable", false);
						this.getModel("controls").setProperty("/duplicateScreen", true);
					}

				}.bind(this),
				dayOfWeek: this.formatter.dayOfWeek.bind(this),

			};
			if (!oDialog) {

				// create dialog via fragment factory
				oDialog = sap.ui.xmlfragment(oView.getId(), "hcm.fab.mytimesheet.view.fragments.DuplicateTask", oDialogController);
				// oDialog.bindElement('TimeDataDuplicateTask>/0');
				// connect dialog to view (models, lifecycle)
				oView.addDependent(oDialog);
			}
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oDialog);

			jQuery.sap.delayedCall(0, this, function () {
				oDialog.open();
				this.focusDuplicateTaskCalendarDate();
			});

		},
		focusDuplicateTaskCalendarDate: function () {
			//method focusDate() available from SAP UI5 version 1.71 and above
			var version = sap.ui.version;
			version = version.split(".");
			if (version[0] >= 1 && version[1] >= 71) {
				//set focus of calendar to last month
				var focusCalendarDate = this.startdate;
				//focusCalendarDate.setDate(focusCalendarDate.getDate() - (focusCalendarDate.getDate() + 1));
				this.byId("duplicateCalendar").focusDate(focusCalendarDate);
				this.byId("mDuplicateCalendar").focusDate(focusCalendarDate);
			}
		},
		handleCopyTarget: function (oEvent) {
			var selectedKey = this.getView().byId("copyFromTarget").getSelectedKey();
			var selectedText = this.getView().byId("copyFromTarget").getValue();
			var that = this;
			that.copyRecordChange = false;

			//Looping over the table records
			//Checking the table model data
			var oModel = this.oTable.getModel("TimeData");
			var data = this.oTable.getModel("TimeData").getData();
			var draftRejectedSum = 0;
			this.oTable.setBusy(true);
			for (var recordIndex = 0; recordIndex < data.length; recordIndex++) {

				//Retrieve the date
				var date1 = new Date(data[recordIndex].HeaderData.date);
				var date2 = null;
				if (recordIndex !== data.length - 1) {
					date2 = new Date(data[recordIndex + 1].HeaderData.date);
				}
				if (data[recordIndex].TimeEntryDataFields.STATUS === "40") {
					draftRejectedSum = parseFloat(draftRejectedSum) + parseFloat(data[recordIndex].TimeEntryDataFields.CATSHOURS);
				}
				var workdate = data[recordIndex].TimeEntryDataFields.WORKDATE;

				if (date2 === null || date1.getYear() !== date2.getYear() || date1.getMonth() !== date2.getMonth() || date1.getDay() !== date2.getDay()) {

					var newDraftRejectedSum = draftRejectedSum;
					draftRejectedSum = 0;
					//Checking for status and any create updation has occured
					if (data[recordIndex].TimeEntryOperation === 'U' || data[recordIndex].TimeEntryOperation === 'C' || data[recordIndex].TimeEntryDataFields
						.STATUS !== "") {
						if (parseFloat(data[recordIndex].HeaderData.target) - parseFloat(data[recordIndex].HeaderData.sum) - newDraftRejectedSum <= 0) {
							continue;
						}
						var newRecord = this.recordTemplate();
						data[recordIndex].addButton = false;
						var insert = $.extend(true, {}, newRecord);
						insert.totalHours = data[recordIndex].totalHours;
						insert.TimeEntryDataFields.WORKDATE = new Date(data[recordIndex].TimeEntryDataFields.WORKDATE);
						insert.target = data[recordIndex].target;
						insert.HeaderData = $.extend(true, {}, data[recordIndex].HeaderData);
						data[recordIndex].HeaderData.addButton = false;
						insert.highlight = sap.ui.core.MessageType.Information;
						insert.HeaderData.highlight = true;
						insert.HeaderData.addButton = true;
						insert.addButton = true;
						var recordHours = parseFloat(data[recordIndex].HeaderData.target) - parseFloat(data[recordIndex].HeaderData.sum) -
							newDraftRejectedSum;
						var taskdata = this.getModel('Tasks').getData();
						var task = $.grep(taskdata, function (element, ind) {
							return element.AssignmentId === selectedKey;
						});
						insert.TimeEntryDataFields = $.extend(true, {}, task[0].AssignmentFields);
						if (this.getModel('controls').getProperty('/approverAllowed')) {
							insert.ApproverId = task[0].ApproverId;
						}
						insert.AssignmentId = task[0].AssignmentId;
						insert.AssignmentName = task[0].AssignmentName;
						insert.TimeEntryDataFields.WORKDATE = workdate;
						insert.TimeEntryDataFields.CATSHOURS = parseFloat(recordHours) + "";
						insert.TimeEntryOperation = 'C';
						insert.TimeEntryDataFields.BEGUZ = "000000";
						insert.TimeEntryDataFields.ENDUZ = "000000";
						insert.highlight = sap.ui.core.MessageType.Information;
						data.splice(recordIndex + 1, 0, insert);
						recordIndex = recordIndex + 1;
						data = this.calculateSum(new Date(data[recordIndex].TimeEntryDataFields.WORKDATE), data);
						that.copyRecordChange = true;
					} else //Make Changes to that last row only
					{
						//Get Total Sum and TargetHours
						if (parseFloat(data[recordIndex].HeaderData.target) - parseFloat(data[recordIndex].HeaderData.sum) - newDraftRejectedSum <= 0) {
							continue;
						}
						var recordHours = parseFloat(data[recordIndex].HeaderData.target) - parseFloat(data[recordIndex].HeaderData.sum) -
							newDraftRejectedSum;

						if (this.checkButtonNeeded === "X") {
							this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
							this.getModel("controls").setProperty("/isOverviewChanged", false);
							this.getModel("controls").setProperty("/overviewDataChanged", false);
						} else {
							this.getModel("controls").setProperty("/isOverviewChanged", true);
							this.getModel("controls").setProperty("/overviewDataChanged", true);
						}
						sap.ushell.Container.setDirtyFlag(true);
						var taskdata = this.getModel('Tasks').getData();
						var task = $.grep(taskdata, function (element, ind) {
							return element.AssignmentId === selectedKey;
						});

						delete data[recordIndex].TimeEntryDataFields;
						data[recordIndex].TimeEntryDataFields = $.extend(true, {}, task[0].AssignmentFields);
						if (this.getModel('controls').getProperty('/approverAllowed')) {
							data[recordIndex].ApproverId = task[0].ApproverId;
						}
						data[recordIndex].TimeEntryDataFields.BEGUZ = "000000";
						data[recordIndex].TimeEntryDataFields.ENDUZ = "000000";
						data[recordIndex].Status = "";
						data[recordIndex].AssignmentId = task[0].AssignmentId;
						data[recordIndex].AssignmentName = task[0].AssignmentName;
						data[recordIndex].TimeEntryDataFields.STATUS = "";
						data[recordIndex].TimeEntryDataFields.WORKDATE = workdate;
						data[recordIndex].TimeEntryDataFields.CATSHOURS = parseFloat(recordHours) + "";
						data[recordIndex].TimeEntryOperation = 'C';
						data[recordIndex].Counter = "";
						data[recordIndex].deleteButtonEnable = true;
						data[recordIndex].addButtonEnable = true;
						data[recordIndex].highlight = sap.ui.core.MessageType.Information;

						data = this.calculateSum(new Date(data[recordIndex].TimeEntryDataFields.WORKDATE), data);
						that.copyRecordChange = true;

					}

				}

				//Ruling out changedRecords and status records

			}

			// that.setFocusFixedElement();
			// if (that.oEditableTemplate) {
			// 	that.rebindTableWithTemplate(that.oTable, "TimeData>/", that.oEditableTemplate, "Edit");
			// }

			oModel.refresh();

			this.oTable.setBusy(false);
			return true;

			//Ruling out changedRecords and status records

		},

		onCopyTarget: function (oEvent) {
			var that = this;
			var oView = this.getView();
			var oTable = this.byId('idTasks');
			var oAssignmentElement = null;
			var oModel = new JSONModel();
			var oDialog;
			var oDialogController = {
				handleCancel: function () {
					oDialog.close();
					oDialog.destroy();
					that.getModel('controls').setProperty("/targetCopyButtonEnabled", false);
				}.bind(this),
				onCopySelectionChange: function (oEvent) {
					try {
						oEvent.getParameter("selectedItem").getKey();
						that.getModel('controls').setProperty("/targetCopyButtonEnabled", true);
					} catch (except) {
						//Empty Assignment has been selectedItems
						//Copy button will not be enabled
						that.getModel('controls').setProperty("/targetCopyButtonEnabled", false);
					}
				},
				activeCopyTasks: function (status, valStart, valEnd, fields, type) {

					try {
						var val = type.toLowerCase();
						if (val) {
							return false;
						}
						var validityDate = new Date(that.startdate);
						validityDate.setHours(0, 0, 0, 0);
						var validityEndDate = new Date(that.enddate);
						validityEndDate.setHours(0, 0, 0, 0);
						if (status === "0") {
							return false;
						}
						if (validityDate.getTime() <= valStart.getTime() && validityEndDate.getTime() >= valEnd.getTime() && status === "1") {
							return true;
						} //In between the period

						if (valStart.getTime() <= validityDate.getTime() && validityEndDate.getTime() <= valEnd.getTime() && status === "1") {
							return true;
						} //Lies in period greater than week

						if (valStart.getTime() <= validityDate.getTime() && valEnd.getTime() >= validityDate.getTime()) {
							return true;
						} //Lies from before start and greater than or equal to start

						if (valStart.getTime() <= validityEndDate.getTime() && valEnd.getTime() >= validityEndDate.getTime()) {
							return true;
						} //Lies from before end to after end period

						return false;
					} catch (e) {
						oDialog.destroy(); //Destroying because duplicate id issue might come
						return false;
					}
				},
				handleCopy: function (oEvent) {
					var sucess = this.handleCopyTarget(oEvent);
					if (sucess) {
						oDialog.close();
						oDialog.destroy();
						if (that.copyRecordChange === true) {
							var toastMsg = that.oBundle.getText("copySuccess");
							sap.m.MessageToast.show(toastMsg, {
								duration: 3000
							});
						} else {
							var toastMsg = that.oBundle.getText("targetHoursMet");
							sap.m.MessageToast.show(toastMsg, {
								duration: 3000
							});
						}
						this.getEnteredHours(true);
						if (this.checkButtonNeeded === "X") {
							this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
							this.getModel("controls").setProperty("/isOverviewChanged", false);
							this.getModel("controls").setProperty("/overviewDataChanged", false);
						} else {
							this.getModel("controls").setProperty("/isOverviewChanged", true);
							this.getModel("controls").setProperty("/overviewDataChanged", true);
						}
						sap.ushell.Container.setDirtyFlag(true);
					}
				}.bind(this)

			};
			if (!oDialog) {
				// create dialog via fragment factory
				oDialog = sap.ui.xmlfragment(oView.getId(), "hcm.fab.mytimesheet.view.fragments.CopyTarget", oDialogController);
				// connect dialog to view (models, lifecycle)
				oView.addDependent(oDialog);
			}
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oDialog);

			jQuery.sap.delayedCall(0, this, function () {
				oDialog.open();
			});

		},
		onDuplicateWeek: function (oEvent) {
			var that = this;
			var oView = this.getView();
			var oTable = this.byId('idTasks');
			var oModel = new JSONModel();
			var oDialog;
			var oDialogController = {
				handleCancel: function () {
					oDialog.close();
					oDialog.destroy();
					this.setModel(new JSONModel({
						selectedWeek: []
					}), "selectedDatesDupWeek");
					this.getModel('controls').setProperty("/duplicateWeekButtonEnable", false);
				}.bind(this),
				concatDates: this.formatter.concatDates.bind(this),
				onDelete: this.deleteSelectedWeeks.bind(this),
				handleDuplicateWeekCalendar: this.handleDuplicateWeekCalendar.bind(this),
				dayOfWeek: this.formatter.dayOfWeek.bind(this),
				formatter: that.formatter,
				formatterStatus: that.formatter.status.bind(that),
				formatterGetDuplicatetTaskEnabled: that.formatter.getDuplicatetTaskEnabled.bind(that),
				formatterAssignmentName: that.formatter.assignmentName.bind(that),
				formatterFormatDuplicateText: that.formatter.formatDuplicateText.bind(that),
				handleConfirm: function (oEvent) {
					var sucess = this.handleConfirmDuplicateWeek(oEvent);
					if (sucess) {
						oDialog.close();
						oDialog.destroy();
						this.calendar.removeAllSelectedDates();
						this.setModel(new JSONModel({
							selectedWeek: []
						}), "selectedDatesDupWeek");
						// if (this.duplicateWeekHrRecord) {
						// 	var toastMsg = that.oBundle.getText("hrRecordWeekNotDuplicated");
						// 	sap.m.MessageToast.show(toastMsg, {
						// 		duration: 3000
						// 	});
						// } else {
						var toastMsg = that.oBundle.getText("duplicatedSuccessfully");
						sap.m.MessageToast.show(toastMsg, {
							duration: 3000
						});
						// }
						if (this.checkButtonNeeded === "X") {
							this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
							this.getModel("controls").setProperty("/isOverviewChanged", false);
							this.getModel("controls").setProperty("/overviewDataChanged", false);
						} else {
							this.getModel("controls").setProperty("/isOverviewChanged", true);
							this.getModel("controls").setProperty("/overviewDataChanged", true);
						}
						this.successfulCheck = "";
						this.resetAdHocControls();
						this.resetTodoAdHocControls();

						this.getModel('controls').setProperty('/isOlderMultipleDays', true);

						sap.ushell.Container.setDirtyFlag(true);
						this.getModel("controls").setProperty("/duplicateScreen", true);
					}
				}.bind(this)

			};
			if (!oDialog) {
				// create dialog via fragment factory
				oDialog = sap.ui.xmlfragment(oView.getId(), "hcm.fab.mytimesheet.view.fragments.DuplicateWeek", oDialogController);
				// connect dialog to view (models, lifecycle)
				oView.addDependent(oDialog);
			}
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oDialog);

			jQuery.sap.delayedCall(0, this, function () {
				oDialog.open();
				this.focusDuplicateWeekCalendarDate();
			});

		},
		focusDuplicateWeekCalendarDate: function () {
			//method focusDate() available from SAP UI5 version 1.71 and above
			var version = sap.ui.version;
			version = version.split(".");
			if (version[0] >= 1 && version[1] >= 71) {
				//set focus of calendar to last month
				var focusCalendarDate = this.startdate;
				//focusCalendarDate.setDate(focusCalendarDate.getDate() - (focusCalendarDate.getDate() + 1));
				this.byId("mDuplicateWeekCalendar").focusDate(focusCalendarDate);
				this.byId("duplicateWeekCalendar").focusDate(focusCalendarDate);
			}
		},
		deleteSelectedWeeks: function (oEvent) {
			var index = oEvent.getParameters().listItem.getBindingContext('selectedDatesDupWeek').getPath().split('/selectedWeek/')[1];
			var data = this.getModel('selectedDatesDupWeek').getData();
			delete data.selectedWeek[index].dateFrom;
			data.selectedWeek.splice(index, 1);
			var oModel = new JSONModel(data);
			this.setModel(oModel, 'selectedDatesDupWeek');
		},
		handleConfirmDuplicateWeek: function (oEvent) {
			var allEntries = $.extend(true, [], this.getModel('TimeEntries').getData());
			var data = $.extend(true, [], this.getModel('TimeData').getData());
			var timeData = data;
			var that = this;
			this.duplicateWeekHrRecord = false;
			var duplicateWeekData = [];
			var timeFrom = new Date(this.oFormatYyyymmdd.format(data[0].TimeEntryDataFields.WORKDATE) + "T00:00:00");
			var timeTo = new Date(this.oFormatYyyymmdd.format(data[data.length - 1].TimeEntryDataFields.WORKDATE) + "T00:00:00");
			if (this.getModel('selectedDatesDupWeek') && this.getModel('selectedDatesDupWeek').getData().selectedWeek.length > 0) {
				var dates = this.getModel('selectedDatesDupWeek').getData().selectedWeek;
			} else {
				var toastMsg = this.oBundle.getText("selectWeekDup");
				sap.m.MessageToast.show(toastMsg, {
					duration: 3000
				});
				return false;
			}
			var oModel = new JSONModel();
			var WeekData = [];
			for (var k = new Date(timeFrom); k <= timeTo; k.setDate(k.getDate() + 1)) {
				var entries = $.grep(data, function (element, index) {
					if (element.Status === "99") {
						that.duplicateWeekHrRecord = true;
					}
					return element.TimeEntryDataFields.WORKDATE.toDateString() === k.toDateString() && element.Status !== "99" && element.AssignmentId !==
						"";
				});
				var day = {
					day: entries
				};
				WeekData.push(day);
			}
			for (var i = 0; i < dates.length; i++) {
				for (var j = new Date(dates[i].dateFrom), k = 0; j <= dates[i].dateTo, k < 7; j.setDate(
						j.getDate() + 1, k++)) {
					for (var m = 0; m < WeekData[k].day.length; m++) {
						var entry = $.extend(true, {}, WeekData[k].day[m]);
						entry.TimeEntryDataFields.WORKDATE = new Date(j);
						entry.Counter = "";
						entry.TimeEntryDataFields.STATUS = "";
						entry.TimeEntryDataFields.LONGTEXT = "";
						entry.TimeEntryDataFields.LONGTEXT_DATA = "";
						entry.TimeEntryDataFields.REFCOUNTER = "";
						entry.TimeEntryDataFields.UNIT = "";
						entry.TimeEntryDataFields.MEINH = "";
						entry.HeaderData.date = new Date(j);
						entry.highlight = sap.ui.core.MessageType.Information;
						entry.HeaderData.highlight = sap.ui.core.MessageType.Information;
						// entry.HeaderData.addButton = true;
						if (entry.TimeEntryDataFields.CATSHOURS !== "0.00") {
							entry.TimeEntryOperation = "C";
						}
						duplicateWeekData.push(entry);
						timeData.push(entry);
					}
				}
			}
			//
			var testdate;
			var dateListTemp = [];
			var dateChange;
			testdate = $.grep(timeData, function (e, i) {
				if (e.TimeEntryOperation !== "") {
					e.highlight = sap.ui.core.MessageType.Information;
					e.HeaderData.highlight = sap.ui.core.MessageType.Information;
					dateChange = {
						"Date": e.HeaderData.date
					};
					dateListTemp.push(dateChange);
					return true;
				} else {
					return false;
				}
			});
			var changeDateList = [];
			$.each(dateListTemp, function (i, e) {
				var matchingItems = $.grep(changeDateList, function (item) {
					return item.Date.getDate() === e.Date.getDate() && item.Date.getMonth() === e.Date.getMonth() && item.Date.getYear() === e
						.Date
						.getYear();

				});
				if (matchingItems.length === 0) changeDateList.push(e);
			});
			var finalDataModel = []; //final list
			var changedDataSet; //updated enteries list
			var createDateSet; //duplicated enteries list
			var allDateSet;
			var tempLength;
			var totalTime;
			for (var index = 0; index < changeDateList.length; index++) {
				totalTime = 0;
				var HeaderData = {
					"addButton": "",
					"date": "",
					"highlight": "",
					"key": "",
					"sum": "",
					"target": ""

				};
				changeDateList[index].Date.setHours(0, 0, 0, 0);
				changedDataSet = $.grep(testdate, function (e) {
					if (e.HeaderData.date.getDate() === changeDateList[index].Date.getDate() &&
						e.HeaderData.date.getMonth() === changeDateList[index].Date.getMonth() &&
						e.HeaderData.date.getYear() === changeDateList[index].Date.getYear() &&
						Boolean(e.Counter)) {
						return true;
					}
				});
				createDateSet = $.grep(testdate, function (e) {
					if (e.HeaderData.date.getDate() === changeDateList[index].Date.getDate() &&
						e.HeaderData.date.getMonth() === changeDateList[index].Date.getMonth() &&
						e.HeaderData.date.getYear() === changeDateList[index].Date.getYear() &&
						!Boolean(e.Counter)) {
						return true;
					}
				});
				var lastRecord = null;
				allDateSet = $.grep(allEntries, function (e) {
					if (e.CaleDate.getDate() === changeDateList[index].Date.getDate() &&
						e.CaleDate.getMonth() === changeDateList[index].Date.getMonth() &&
						e.CaleDate.getYear() === changeDateList[index].Date.getYear()) {
						return true;
					}
				});
				HeaderData.addButton = false;
				HeaderData.date = changeDateList[index].Date;
				HeaderData.highlight = false;
				HeaderData.key = changeDateList[index].Date;
				HeaderData.sum = "";
				HeaderData.target = allDateSet[0].TargetHours;
				for (i = 0; i < allDateSet[0].TimeEntries.results.length; i++) {
					allDateSet[0].TimeEntries.results[i].HeaderData = HeaderData;
					allDateSet[0].TimeEntries.results[i].target = HeaderData.target;
					if (allDateSet[0].TimeEntries.results[i].Status === "10") {
						allDateSet[0].TimeEntries.results[i].SetDraft = true;
					} else {
						allDateSet[0].TimeEntries.results[i].SetDraft = false;
					}
				}
				allDateSet = allDateSet[0].TimeEntries.results;
				for (var i = 0; i < allDateSet.length; i++) {
					var check = false;
					for (var j = 0; j < changedDataSet.length; j++) {
						if (allDateSet[i].Counter === changedDataSet[j].Counter) {
							finalDataModel.push(changedDataSet[j]);
							tempLength = finalDataModel.length - 1;
							finalDataModel[tempLength].addButton = false;
							finalDataModel[tempLength].HeaderData.addButton = false;
							finalDataModel[tempLength].addButtonEnable = false;
							finalDataModel[tempLength].deleteButton = true;
							finalDataModel[tempLength].deleteButtonEnable = true;
							finalDataModel[tempLength].target = HeaderData.target;
							finalDataModel[tempLength].HeaderData.target = HeaderData.target;
							check = true;
							continue;
						}
					}
					if (!check) {
						finalDataModel.push(allDateSet[i]);
						tempLength = finalDataModel.length - 1;
						finalDataModel[tempLength].addButton = false;
						finalDataModel[tempLength].HeaderData.addButton = false;
						finalDataModel[tempLength].addButtonEnable = false;
						finalDataModel[tempLength].deleteButton = true;
						finalDataModel[tempLength].deleteButtonEnable = true;
						finalDataModel[tempLength].target = HeaderData.target;
						finalDataModel[tempLength].HeaderData.target = HeaderData.target;
					}
				}
				for (i = 0; i < createDateSet.length; i++) {
					finalDataModel.push(createDateSet[i]);
					tempLength = finalDataModel.length - 1;
					finalDataModel[tempLength].addButton = false;
					finalDataModel[tempLength].HeaderData.addButton = false;
					finalDataModel[tempLength].addButtonEnable = false;
					finalDataModel[tempLength].deleteButton = true;
					finalDataModel[tempLength].deleteButtonEnable = true;
					finalDataModel[tempLength].target = HeaderData.target;
					finalDataModel[tempLength].HeaderData.target = HeaderData.target;
				}
				finalDataModel = this.calculateSum(changeDateList[index].Date, finalDataModel);
				tempLength = finalDataModel.length - 1;
				finalDataModel[tempLength].HeaderData.addButton = false;
				finalDataModel[tempLength].addButton = true;
				finalDataModel[tempLength].addButtonEnable = true;
			}
			//
			oModel.setData(finalDataModel);
			//oModel.setData(timeData);
			this.setModel(oModel, "TimeData");
			this.oTable.bindItems({
				path: 'TimeData>/',
				sorter: [new sap.ui.model.Sorter("HeaderData", false, true, this.compareRows)],
				template: this.oEditableTemplate,
				templateShareable: true,
				key: "overviewBind",
				groupHeaderFactory: this.getGroupHeader.bind(this)
			}).setKeyboardMode('Edit');
			this.getModel('controls').setProperty("/duplicateWeekButtonEnable", false);
			return true;
		},
		handleDuplicateWeekCalSelect: function (oEvent) {
			var oCalendar = oEvent.getSource();
			var aSelectedDates = oCalendar.getSelectedDates();
			var oDate;
			var oData = {
				selectedDates: []
			};
			var oModel = new JSONModel();
			if (aSelectedDates.length > 0) {
				for (var i = 0; i < aSelectedDates.length; i++) {
					oDate = aSelectedDates[i].getStartDate();
					oData.selectedDates.push({
						Date: oDate
					});
				}
				oModel.setData(oData);
				this.setModel(oModel, 'selectedDatesDup');
			} else {
				// this._clearModel();
			}
		},
		onOverviewSelect: function (oEvent) {
			var that = this;
			var selectedItem = oEvent;
			var oControl = this.getModel('controls');
			var data = this.getModel('TimeData');
			var oModel = new JSONModel();
			var index = null;
			var data = this.getModel('TimeData').getData();
			var taskModel = this.getModel('TimeDataDuplicateTask');
			var task = [];
			if (oEvent.getParameters().listItem.getBindingContext('TimeData')) {
				index = oEvent.getParameters().listItem.getBindingContext('TimeData').getPath().split('/')[1];
				data[index].TimeEntryOperation = "";
				var previousSelected = $.grep(data, function (element, ind) {
					return element.TimeEntryOperation == 'R';
				});
				for (var i = 0; i < previousSelected.length; i++) {
					previousSelected[i].TimeEntryOperation = "";
				}
			}
			if (this.oTable.getSelectedItems().length >= 1) {
				var selected = this.oTable.getSelectedContextPaths();
				for (var i = 0; i < selected.length; i++) {
					if (data[selected[i].split('/')[1]].Counter !==
						null && data[selected[i].split('/')[1]].Counter && data[selected[i].split('/')[1]].Counter !== "" || (parseFloat(data[
							selected[
								i]
							.split('/')[1]].TimeEntryDataFields.CATSHOURS).toFixed(2) !== parseFloat("0.00").toFixed(2) || parseFloat(data[selected[i].split(
							'/')[1]].TimeEntryDataFields.CATSQUANTITY).toFixed(2) !== parseFloat("0.00").toFixed(2) || parseFloat(data[selected[i].split(
							'/')[1]].TimeEntryDataFields.CATSAMOUNT).toFixed(2) !== parseFloat("0.00").toFixed(2))) {
						data[selected[i].split('/')[1]].TimeEntryOperation = "R";
						task.push($.extend(true, {}, data[selected[i].split('/')[1]]));
						// oControl.setProperty('/duplicateTaskEnable', true);
					}
				}
			} else {
				// oControl.setProperty('/duplicateTaskEnable', false);
				// oControl.setProperty('/duplicateWeekEnable', true);
			}
			oModel.setData(task);
			this.setModel(oModel, 'TimeDataDuplicateTask');
			that.calculateChangeCount();
			that.getEnteredHours(false);
		},
		onOverviewSelectDup: function (oEvent) {
			var that = this;
			var selectedItem = oEvent;
			var oControl = this.getModel('controls');
			var data = this.getModel('TimeData');
			var oModel = new JSONModel();
			var index = null;
			var data = this.getModel('TimeData').getData();
			var taskModel = this.getModel('TimeDataDuplicateTask');
			var task = [];
			if (oEvent.getSource().getSelectedItems().length >= 1) {
				// oControl.setProperty('/duplicateTaskEnable', true);
				var selected = oEvent.getSource().getSelectedContextPaths();
				for (var i = 0; i < selected.length; i++) {
					task.push($.extend(true, {}, data[selected[i].split('/')[1]]));
				}
			} else {
				// oControl.setProperty('/duplicateTaskEnable', false);
				// oControl.setProperty('/duplicateWeekEnable', true);
			}
			oModel.setData(task);
			this.setModel(oModel, 'TimeDataDuplicateTask');
			if (this.getModel("selectedDatesDup")) {
				if (this.getModel("selectedDatesDup").getData().selectedDates.length >= 1 &&
					this.getModel("TimeDataDuplicateTask").getData().length >= 1) {
					this.getModel("controls").setProperty("/duplicateTaskButtonEnable", true);
				} else {
					this.getModel("controls").setProperty("/duplicateTaskButtonEnable", false);
				}
			}
			// that.calculateChangeCount();
		},
		handleDuplicateTaskConfirm: function () {
			var entries = $.extend(true, [], this.getModel('TimeEntries').getData());
			if (this.getModel("TimeDataDuplicateTask") && this.getModel("TimeDataDuplicateTask").getData().length > 0) {
				var oModel = this.getModel("TimeDataDuplicateTask");
			} else {
				var toastMsg = this.oBundle.getText("selectRecordDup");
				sap.m.MessageToast.show(toastMsg, {
					duration: 3000
				});
				return false;
			}
			var data = $.extend(true, [], oModel.getData());
			var hrRecord = $.grep(data, function (element, ind) {
				return element.Status === "99";
			});
			if (hrRecord.length > 0) {
				return "HrRecord";
			}
			if (this.getModel("selectedDatesDup") && this.getModel("selectedDatesDup").getData().selectedDates.length > 0) {
				var dates = this.getModel("selectedDatesDup").getData();
			} else {
				var toastMsg = this.oBundle.getText("selectDatesDup");
				sap.m.MessageToast.show(toastMsg, {
					duration: 3000
				});
				return false;
			}
			var duplicateTaskData = [];
			var timeData = this.getModel("TimeData").getData();

			for (var i = 0; i < dates.selectedDates.length; i++) {
				data = $.extend(true, [], oModel.getData());
				for (var j = 0; j < data.length; j++) {
					data[j].TimeEntryDataFields.WORKDATE = new Date(dates.selectedDates[i].Date);
					data[j].Counter = "";
					data[j].TimeEntryOperation = 'C';
					data[j].TimeEntryDataFields.STATUS = "";
					data[j].TimeEntryDataFields.LONGTEXT = "";
					data[j].TimeEntryDataFields.LONGTEXT_DATA = "";
					data[j].TimeEntryDataFields.UNIT = "";
					data[j].TimeEntryDataFields.MEINH = "";
					data[j].HeaderData.date = new Date(dates.selectedDates[i].Date);
					data[j].HeaderData.key = new Date(dates.selectedDates[i].Date);
					data[j].highlight = sap.ui.core.MessageType.Information;
					data[j].HeaderData.highlight = sap.ui.core.MessageType.Information;
					data[j].HeaderData.addButton = false;
					data[j].addButton = false;
					if (j == 0) {
						var select = $.grep(timeData, function (element, ind) {
							return element.TimeEntryDataFields.WORKDATE.toDateString() === data[j].TimeEntryDataFields.WORKDATE.toDateString();
						});
						if (select.length === 0) {
							data[j].HeaderData.addButton = true;
							data[j].addButton = true;
						}
					}

					timeData.push(data[j]);
					duplicateTaskData.push(data[j]);
				}
			}
			var testdate;
			var dateListTemp = [];
			var dateChange;
			testdate = $.grep(timeData, function (e, i) {
				if (e.TimeEntryOperation !== "") {
					e.highlight = sap.ui.core.MessageType.Information;
					e.HeaderData.highlight = sap.ui.core.MessageType.Information;
					dateChange = {
						"Date": e.HeaderData.date
					};
					dateListTemp.push(dateChange);
					return true;
				} else {
					return false;
				}
			});
			var changeDateList = [];
			$.each(dateListTemp, function (i, e) {
				var matchingItems = $.grep(changeDateList, function (item) {
					return item.Date.getDate() === e.Date.getDate() && item.Date.getMonth() === e.Date.getMonth() && item.Date.getYear() === e
						.Date
						.getYear();

				});
				if (matchingItems.length === 0) changeDateList.push(e);
			});
			var finalDataModel = []; //final list
			var changedDataSet; //updated enteries list
			var createDateSet; //duplicated enteries list
			var allDateSet;
			var tempLength;
			var totalTime;
			for (var index = 0; index < changeDateList.length; index++) {
				totalTime = 0;
				var HeaderData = {
					"addButton": "",
					"date": "",
					"highlight": "",
					"key": "",
					"sum": "",
					"target": ""

				};
				changeDateList[index].Date.setHours(0, 0, 0, 0);
				changedDataSet = $.grep(testdate, function (e) {
					if (e.HeaderData.date.getDate() === changeDateList[index].Date.getDate() &&
						e.HeaderData.date.getMonth() === changeDateList[index].Date.getMonth() &&
						e.HeaderData.date.getYear() === changeDateList[index].Date.getYear() &&
						Boolean(e.Counter)) {
						return true;
					}
				});
				createDateSet = $.grep(testdate, function (e) {
					if (e.HeaderData.date.getDate() === changeDateList[index].Date.getDate() &&
						e.HeaderData.date.getMonth() === changeDateList[index].Date.getMonth() &&
						e.HeaderData.date.getYear() === changeDateList[index].Date.getYear() &&
						!Boolean(e.Counter)) {
						return true;
					}
				});
				var lastRecord = null;
				allDateSet = $.grep(entries, function (e) {
					if (e.CaleDate.getDate() === changeDateList[index].Date.getDate() &&
						e.CaleDate.getMonth() === changeDateList[index].Date.getMonth() &&
						e.CaleDate.getYear() === changeDateList[index].Date.getYear()) {
						return true;
					}
				});
				HeaderData.addButton = false;
				HeaderData.date = changeDateList[index].Date;
				HeaderData.highlight = false;
				HeaderData.key = changeDateList[index].Date;
				HeaderData.sum = "";
				HeaderData.target = allDateSet[0].TargetHours;
				for (i = 0; i < allDateSet[0].TimeEntries.results.length; i++) {
					allDateSet[0].TimeEntries.results[i].HeaderData = HeaderData;
					allDateSet[0].TimeEntries.results[i].target = HeaderData.target;
					if (allDateSet[0].TimeEntries.results[i].Status === "10") {
						allDateSet[0].TimeEntries.results[i].SetDraft = true;
					} else {
						allDateSet[0].TimeEntries.results[i].SetDraft = false;
					}
				}
				allDateSet = allDateSet[0].TimeEntries.results;
				for (var i = 0; i < allDateSet.length; i++) {
					var check = false;
					for (var j = 0; j < changedDataSet.length; j++) {
						if (allDateSet[i].Counter === changedDataSet[j].Counter) {
							finalDataModel.push(changedDataSet[j]);
							tempLength = finalDataModel.length - 1;
							finalDataModel[tempLength].addButton = false;
							finalDataModel[tempLength].HeaderData.addButton = false;
							finalDataModel[tempLength].addButtonEnable = false;
							finalDataModel[tempLength].deleteButton = true;
							finalDataModel[tempLength].deleteButtonEnable = true;
							finalDataModel[tempLength].target = HeaderData.target;
							finalDataModel[tempLength].HeaderData.target = HeaderData.target;
							check = true;
							continue;
						}
					}
					if (!check) {
						finalDataModel.push(allDateSet[i]);
						tempLength = finalDataModel.length - 1;
						finalDataModel[tempLength].addButton = false;
						finalDataModel[tempLength].HeaderData.addButton = false;
						finalDataModel[tempLength].addButtonEnable = false;
						finalDataModel[tempLength].deleteButton = true;
						finalDataModel[tempLength].deleteButtonEnable = true;
						finalDataModel[tempLength].target = HeaderData.target;
						finalDataModel[tempLength].HeaderData.target = HeaderData.target;
					}
				}
				for (i = 0; i < createDateSet.length; i++) {
					finalDataModel.push(createDateSet[i]);
					tempLength = finalDataModel.length - 1;
					finalDataModel[tempLength].addButton = false;
					finalDataModel[tempLength].HeaderData.addButton = false;
					finalDataModel[tempLength].addButtonEnable = false;
					finalDataModel[tempLength].deleteButton = true;
					finalDataModel[tempLength].deleteButtonEnable = true;
					finalDataModel[tempLength].target = HeaderData.target;
					finalDataModel[tempLength].HeaderData.target = HeaderData.target;
				}
				finalDataModel = this.calculateSum(changeDateList[index].Date, finalDataModel);
				tempLength = finalDataModel.length - 1;
				finalDataModel[tempLength].HeaderData.addButton = false;
				finalDataModel[tempLength].addButton = true;
				finalDataModel[tempLength].addButtonEnable = true;
			}
			oModel.setData(finalDataModel);
			this.setModel(oModel, "TimeData");
			this.oTable.bindItems({
				path: 'TimeData>/',
				sorter: [new sap.ui.model.Sorter("HeaderData", false, true, this.compareRows)],
				template: this.oEditableTemplate,
				templateShareable: true,
				key: "overviewBind",
				groupHeaderFactory: this.getGroupHeader.bind(this)
			}).setKeyboardMode('Edit');
			return true;
		},
		promiseText: function (fieldName, value) {
			var that = this;
			return new Promise(function (fnResolve, fnReject) {
				that.getFieldText(fieldName, value);
				fnResolve(this.getModel(fieldName));
			}).bind(this);
		},

		onAssignmentQuickView: function (oEvent) {
			var that = this;
			var index, timeData = [];
			if (this.getModel('controls').getProperty('/currentAdHoc')) {
				index = parseInt(oEvent.getSource().getBindingContext('RecordedVsTargetModel').sPath.split('/')[1]);
				timeData = this.getModel('RecordedVsTargetModel').getData();
			} else if (this.getModel('controls').getProperty('/currentTodo')) {
				timeData = this.getModel('RecordedVsTargetModel').getData();
				index = parseInt(oEvent.getSource().getBindingContext('RecordedVsTargetModel').sPath.split('/')[1]);

			} else if (this.getModel('controls').getProperty('/currentTodoAdHoc')) {
				timeData = this.getModel('RecordedVsTargetModel').getData();
				index = parseInt(oEvent.getSource().getBindingContext('RecordedVsTargetModel').sPath.split('/')[1]);
			} else {
				if (oEvent.getSource().getCustomData().length !== 0) {
					if (oEvent.getSource().getCustomData()[0].getKey() === "counter") {
						// Invoked from recorded Vs target column list in To Do List
						index = 0;
						var selectedCounter = oEvent.getSource().getCustomData()[0].getProperty("value");
						var selectedWorkdate = oEvent.getSource().getCustomData()[1].getProperty("value");
						var timeEntriesData = that.getModel("TimeEntries").oData;
						var selectedDayEntries = $.grep(timeEntriesData, function (element, index) {
							return element.CaleDate.toDateString() == selectedWorkdate.toDateString();
						});
						for (var m = 0; m < selectedDayEntries[0].TimeEntries.results.length; m++) {
							if (selectedDayEntries[0].TimeEntries.results[m].Counter === selectedCounter) {
								timeData[0] = selectedDayEntries[0].TimeEntries.results[m];
							}
						}
					} else {
						//Invoked in Overview from Assignment Column
						index = oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1];
						timeData = this.getModel('TimeData').getData();
					}
				} else {
					//Invoked in Overview from Assignment Column
					index = oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1];
					timeData = this.getModel('TimeData').getData();
				}
			}
			var profileData = this.getModel('ProfileFields').getData();
			var data = [{
				label: this.oBundle.getText("name"),
				value: timeData[index].AssignmentName
			}];
			var item;
			var element = {
				label: null,
				value: null,
				fieldname: null
			};
			profileData.forEach(function (item, ind) {
				var oModel = that.getModel(item.FieldName);
				if (oModel) {
					var text = oModel.getData();
				}
				if (item.FieldName !== "AssignmentStatus" && item.FieldName !== "APPROVER" && item.FieldName !== "AssignmentName" && item.FieldName !==
					"ValidityStartDate" && item.FieldName !== "ValidityEndDate") {
					element.label = item.FieldLabel;
					element.fieldname = item.FieldName;
					element.GroupPosition = item.GroupPosition;
					element.GroupName = item.GroupName;
					element.value = timeData[index].TimeEntryDataFields[item.FieldName];
					var fieldValue = timeData[index].TimeEntryDataFields[item.FieldName];
					if (text) {
						var textFound = $.grep(text, function (element, ind) {
							return element.DispField1Id === fieldValue;
						});
						if (textFound.length && textFound.length > 0) {
							element.value = timeData[index].TimeEntryDataFields[item.FieldName] + "  " + textFound[0].DispField1Val;
						} else {
							if (item.DispValueText === "TRUE") {
								if (fieldValue !== "") {

									that.getFieldText(item.FieldName, fieldValue).then(function (oModel) {
										var timeData = that.getModel("TimeDataDetail").getData();
										if (oModel) {
											var text = oModel.getData();
											if (text) {
												var textFound = $.grep(text, function (element, ind) {
													return element.DispField1Id === fieldValue;
												});
												if (textFound.length && textFound.length > 0) {
													var element = $.grep(timeData, function (element, index) {
														return element.fieldname === text[text.length - 1].FieldName;
													});
													element[0].value = element[0].value + "  " + textFound[0].DispField1Val;
													that.setModel(new JSONModel(timeData), "TimeDataDetail");
												}
											}
										}
									}.bind(this));
								}
							} else {
								element.value = timeData[index].TimeEntryDataFields[item.FieldName];
							}
						}
					} else {
						if (item.DispValueText === "TRUE") {
							if (fieldValue !== "") {
								that.getFieldText(item.FieldName, fieldValue).then(function (oModel) {
									var timeData = that.getModel("TimeDataDetail").getData();
									if (oModel) {
										var text = oModel.getData();
										if (text) {
											var textFound = $.grep(text, function (element, ind) {
												return element.DispField1Id === fieldValue;
											});
											if (textFound.length && textFound.length > 0) {
												var element = $.grep(timeData, function (element, index) {
													return element.fieldname === text[text.length - 1].FieldName;
												});
												element[0].value = element[0].value + "  " + textFound[0].DispField1Val;
												that.setModel(new JSONModel(timeData), "TimeDataDetail");
											}
										}
									}
								}.bind(this));
							}
						} else {
							element.value = timeData[index].TimeEntryDataFields[item.FieldName];
						}

					}
					// element.value = textFound[0].FieldValue + "(" + timeData[index].TimeEntryDataFields[item.FieldName] + ")";
					item = $.extend(true, {}, element);
					if (!isNaN(item.value)) {
						if (parseInt(item.value) == 0 || isNaN(parseInt(item.value))) {
							item.value = "";
						} else {
							item.value = parseInt(item.value);
						}
					}
					data.push(item);
				}

			});

			var val = data[0];
			data = $.grep(data, function (element) {
				try {

					if (isNaN(parseFloat(element.value))) {
						if (element.value) {
							return true;
						}
						return false;
					}
					if (parseFloat(element.value)) {
						return true;
					}
					return false;
				} catch (e) {
					return false;
				}
			});
			for (var index = 0; index < data.length; index++) {
				if (data[index].field === "BEGUZ") {
					data[index].value = this.formatter.formatTime(data[index].value);
				}
				if (data[index].field === "ENDUZ") {
					data[index].value = this.formatter.formatTime(data[index].value);
				}

			}
			for (var index = 0; index < data.length; index++) {
				if (data[index].fieldname === "BEGUZ") {
					var dummyString = "000000";
					var length = data[index].value.toString().length;
					data[index].value = dummyString.substring(0, dummyString.length - length) + data[index].value;
					data[index].value = this.formatter.formatTime(data[index].value);
				}
				if (data[index].fieldname === "ENDUZ") {
					var dummyString = "000000";
					var length = data[index].value.toString().length;
					data[index].value = dummyString.substring(0, dummyString.length - length) + data[index].value;
					data[index].value = this.formatter.formatTime(data[index].value);
				}

			}
			//Pushing the name field
			//Manipulation of final data so that it could be used as a grouping 
			//creating a new json
			var oGroupingJson = {
				"GroupPosition": "",
				"GroupName": "",
				"groupData": new Array(0),
				initializer: function (GroupPosition, GroupName) {
					this.GroupPosition = GroupPosition;
					this.GroupName = GroupName;
					this.groupData = new Array(0);
				}

			};
			var finalData = new Array(0);

			data.push({}); //Pushing last dummy variable
			//Looping over the data and creating a grouping
			for (var it = 0; it < data.length - 1; it++) {
				//Grouping the fields

				if (data[it].GroupPosition === undefined) {
					//Case of assignment 
					continue;

				}
				if (data[it].GroupPosition === data[it + 1].GroupPosition) {
					if (finalData.length === 0) {
						var obj = Object.create(oGroupingJson);
						obj.initializer(data[it].GroupPosition, data[it].GroupName);

						obj.groupData.push(data[it]);
						finalData.push(obj);
					} else {
						finalData[finalData.length - 1].groupData.push(data[it]);
					}
				} else {
					if (finalData.length === 0) {
						var obj = Object.create(oGroupingJson);
						obj.initializer(data[it].GroupPosition, data[it].GroupName);

						obj.groupData.push(data[it]);
						finalData.push(obj);
					} else

					{
						finalData[finalData.length - 1].groupData.push(data[it]);
					}

					var obj1 = Object.create(oGroupingJson);
					obj1.initializer(data[it + 1].GroupPosition, data[it + 1].GroupName);
					finalData.push(obj1);

				}

			}

			finalData.pop();
			for (var i = 0; i < finalData.length; i++) {
				if (finalData[i].GroupName === "") {
					finalData[i].GroupName = this.getModel("i18n").getResourceBundle().getText('defaultFieldGroupName');
				}
			}
			//Assignment Name
			var AssignmentName = data[0];
			AssignmentName.groupData = Array(0);
			AssignmentName.groupData.push({
				label: AssignmentName.label,
				value: AssignmentName.value
			});
			finalData.unshift(AssignmentName);

			//Setting a model for assignment name and grouping
			this.setModel(new JSONModel({
				name: AssignmentName
			}), "AssignmentNameModel");
			this.setModel(new JSONModel(finalData), "AssignmentGrouping");

			var oModel = new JSONModel(data);
			this.setModel(oModel, "TimeDataDetail");
			var oDialog;
			if (oDialog) {
				oDialog.close();
			}
			var oDialogController = {
				handleClose: function (event) {
					oDialog.close();
				}
			};
			if (!oDialog) {
				oDialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.AssignmentQuickView",
					oDialogController);
				this.getView().addDependent(oDialog);
				// oDialog.bindElement('TimeData>' + oEvent.getSource().getBindingContext('TimeData').getPath());
			}

			// delay because addDependent will do a async rerendering and the popover will immediately close without it
			var oButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function () {
				oDialog.openBy(oButton);
			});
		},

		UpdateTask: function (TaskData) {
			var that = this;
			var oModel = new JSONModel();
			var mParameters = {
				success: function (oData, oResponse) {
					var data = oData.results;
				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.create('/AssignmentCollection', TaskData, mParameters);
		},
		SubmitTask: function (TaskData) {
			var that = this;
			var oModel = new JSONModel();
			var mParameters = {
				success: function (oData, oResponse) {
					var data = oData.results;
					var toastMsg = that.oBundle.getText("taskSaved");
					sap.m.MessageToast.show(toastMsg, {
						duration: 1000
					});
					that.getTasks(false, that.minNavDate, that.maxNavDate);
					//Closing the dialog
					if (that.getModel('controls').getProperty('/currentAdHoc') || that.getModel('controls').getProperty('/currentTodoAdHoc')) {
						that.getView().byId("saveAssignment").destroy();
						that.oAssignmentDialog.close();
					}

				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.create('/AssignmentCollection', TaskData, mParameters);
			// this.oDataModel.submitChanges();
		},

		iconTabSelection: function (oEvent) {
			var oControl = this.getModel('controls');
			var that = this;
			//Fixing the table header
			try {
				if (sap.ui.Device.system.phone === false) {
					this.byId("DynamicSideContent")._oMCScroller._$Container.css("overflow", "visible");
				}
			} catch (exception) {

			}
			if (oEvent.getParameter('section').getId().split("worklist--")[1] === "todolist") {
				oControl.setProperty('/currentTodo', true);
			} else {
				oControl.setProperty('/currentTodo', false);
			}

			//Handling display of progress indicator on mobile
			if (sap.ui.Device.system.phone) {
				if ((oEvent.getParameter('section').getId().split("worklist--")[1] === "overview") && (oControl.getProperty("/totalTarget") ===
						true)) {
					this.byId("mProgressLayout").setVisible(true);
					this.byId("mSnappedProgressLayout").setVisible(true);
				} else {
					this.byId("mProgressLayout").setVisible(false);
					this.byId("mSnappedProgressLayout").setVisible(false);
				}
			}

			var messageHeader = that.oBundle.getText("confirmationSwitchTab");
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			if (this.filterAppliedFlag === "X" && oEvent.getParameter('section').getId().split("worklist--")[1] !== "tasks") {
				sap.m.MessageBox.warning(
					messageHeader, {
						title: that.oBundle.getText("confirm"),
						actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
						styleClass: bCompact ? "sapUiSizeCompact" : "",
						onClose: function (sAction) {
							if (sAction === "CANCEL") {
								// that.byId("ObjectPageLayout").setSelectedSection("application-MyTimesheet-display-component---worklist--tasks");
								that.byId("ObjectPageLayout").setSelectedSection(that.byId("ObjectPageLayout").getSections()[2].getId());
								oControl.setProperty("/todoDoneCheck", true);
								oControl.setProperty("/todoDone", true);
								oControl.setProperty("/todoCancel", true);
								oControl.setProperty("/showFooter", true);
								return;
							} else {
								that.filteDateFrom = "";
								that.filterDateTo = "";
								that.getView().byId("filterGroupAssignment").setType(sap.m.ButtonType.Transparent);
								that.filterAppliedFlag = "";
								that.getTasks(false, that.minNavDate, that.maxNavDate);
								sap.ui.getCore().getMessageManager().removeAllMessages();
								if (oEvent.getParameter('section'))
									this.iconTabSelectionProcessing(oEvent.getParameter('section').getId().split("worklist--")[1]);
							}
						}
					}

				);
			}
			if ((oControl.getProperty("/isOverviewChanged") || oControl.getProperty("/overviewDataChanged") || oControl.getProperty(
					"/overviewDataChangedWithCheck") === true) && oEvent.getParameter(
					'section')
				.getId()
				.split("worklist--")[1] !== "overview") {
				sap.m.MessageBox.warning(
					that.oBundle.getText("confirmationSwitchTabGeneral"), {
						title: that.oBundle.getText("confirm"),
						actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
						styleClass: bCompact ? "sapUiSizeCompact" : "",
						onClose: function (sAction) {
							if (sAction === "CANCEL") {
								// that.byId("ObjectPageLayout").setSelectedSection("application-MyTimesheet-display-component---worklist--tasks");
								that.byId("ObjectPageLayout").setSelectedSection(that.byId("ObjectPageLayout").getSections()[0].getId());
								oControl.setProperty("/sendForApprovalCheck", true);
								oControl.setProperty("/sendForApproval", true);
								oControl.setProperty("/overviewCancel", true);
								oControl.setProperty("/showFooter", true);
								return;
							} else {

								that.onCancel();
								oControl.setProperty("/overviewEdit", false);
								sap.ui.getCore().getMessageManager().removeAllMessages();
								if (oEvent.getParameter('section'))
									this.iconTabSelectionProcessing(oEvent.getParameter('section').getId().split("worklist--")[1]);
							}
						}
					}

				);
			} else if (!(oControl.getProperty("/isOverviewChanged") || oControl.getProperty("/overviewDataChanged") || oControl.getProperty(
					"/overviewDataChangedWithCheck") === true) && oEvent.getParameter(
					'section').getId().split("worklist--")[1] !== "overview") {
				that.onCancel();
				if (oControl.getProperty("/isToDoChanged") || oControl.getProperty("/todoDataChanged") || oControl.getProperty(
						"/todoDataChangedWithCheck") === true) {
					oControl.setProperty("/showFooter", true);
				}
				// this.iconTabSelectionProcessing(oEvent.getParameter('section').getId().split("worklist--")[1]);
			}
			if ((oControl.getProperty("/isToDoChanged") || oControl.getProperty("/todoDataChanged") || oControl.getProperty(
					"/todoDataChangedWithCheck") === true) && oEvent.getParameter('section').getId()
				.split(
					"worklist--")[1] !== "todolist") {
				sap.m.MessageBox.warning(
					that.oBundle.getText("confirmationSwitchTabGeneral"), {
						title: that.oBundle.getText("confirm"),
						actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
						styleClass: bCompact ? "sapUiSizeCompact" : "",
						onClose: function (sAction) {
							if (sAction === "CANCEL") {
								that.byId("ObjectPageLayout").setSelectedSection(that.byId("ObjectPageLayout").getSections()[1].getId());
								oControl.setProperty("/todoDoneCheck", true);
								oControl.setProperty("/todoDone", true);
								oControl.setProperty("/todoCancel", true);
								oControl.setProperty("/showFooter", true);
								return;
							} else {
								that.onTodoCancel();
								that.getModel('controls').setProperty('/editTodoVisibility', false);
								if (that.checkButtonNeeded === "X") {
									oControl.setProperty('/todoDataChangedWithCheck', false);
								}
								oControl.setProperty('/todoDataChanged', false);
								oControl.setProperty('/isToDoChanged', false);
								sap.ushell.Container.setDirtyFlag(false);
								sap.ui.getCore().getMessageManager().removeAllMessages();
								if (oEvent.getParameter('section'))
									this.iconTabSelectionProcessing(oEvent.getParameter('section').getId().split("worklist--")[1]);
							}
						}
					}

				);
			} else if (!(oControl.getProperty("/isToDoChanged") || oControl.getProperty("/todoDataChanged") || oControl.getProperty(
					"/todoDataChangedWithCheck") === true) && oEvent.getParameter(
					'section')
				.getId()
				.split(
					"worklist--")[1] !== "todolist") {
				that.onTodoCancel();
				if (that.checkButtonNeeded === "X") {
					oControl.setProperty('/todoDataChangedWithCheck', false);
				}
				oControl.setProperty('/todoDataChanged', false);
				oControl.setProperty('/isToDoChanged', false);
				sap.ushell.Container.setDirtyFlag(false);
				if (oControl.getProperty("/isOverviewChanged") || oControl.getProperty("/overviewDataChanged") || oControl.getProperty(
						"/overviewDataChangedWithCheck") === true) {
					oControl.setProperty("/showFooter", true);
				}
				// this.iconTabSelectionProcessing(oEvent.getParameter('section').getId().split("worklist--")[1]);
			}
			// this.iconTabSelectionProcessing(oEvent.getParameter('section').getId().split("worklist--")[1]);

			//Handling footer button visibility
			if (oEvent.getParameter('section').getId().split("worklist--")[1] === "overview") {
				oControl.setProperty("/overviewEdit", true);
				oControl.setProperty("/editTodoVisibility", false);
				oControl.setProperty("/todoDoneCheck", false);
				oControl.setProperty("/todoDone", false);
				oControl.setProperty("/todoCancel", false);
				if (sap.ui.Device.system.phone) {
					oControl.setProperty("/showFooter", true);
				}
			}
			if (oEvent.getParameter('section').getId().split("worklist--")[1] === "todolist") {
				oControl.setProperty("/editTodoVisibility", true);
				oControl.setProperty("/overviewEdit", false);
				oControl.setProperty("/sendForApprovalCheck", false);
				oControl.setProperty("/sendForApproval", false);
				oControl.setProperty("/overviewCancel", false);
				if (sap.ui.Device.system.phone) {
					oControl.setProperty("/showFooter", true);
				}
			}
			if (oEvent.getParameter('section').getId().split("worklist--")[1] === "tasks" || oEvent.getParameter('section').getId().split(
					"worklist--")[1] === "groups") {
				oControl.setProperty("/editTodoVisibility", false);
				oControl.setProperty("/overviewEdit", false);
				oControl.setProperty("/sendForApprovalCheck", false);
				oControl.setProperty("/sendForApproval", false);
				oControl.setProperty("/overviewCancel", false);
				oControl.setProperty("/todoDoneCheck", false);
				oControl.setProperty("/todoDone", false);
				oControl.setProperty("/todoCancel", false);
				oControl.setProperty("/showFooter", false);
			}
		},
		iconTabSelectionProcessing: function (section) {
			var oControl = this.getModel('controls');
			if (section == "overview") {
				if (!sap.ui.Device.system.phone) {
					oControl.setProperty('/showFooter', false);
				}
				// oControl.setProperty('/todoCancel', false);
				oControl.setProperty('/currentTodo', false);

				oControl.setProperty('/overviewEdit', true);
				oControl.setProperty('/editTodoVisibility', true);
				oControl.setProperty('/duplicateVisibility', false);
				oControl.setProperty('/duplicateWeekVisibility', false);
				// oControl.setProperty('/todoDone', false);
				if (this.oReadOnlyToDoTemplate) {
					this.rebindTableWithTemplate(this.oToDoTable, "TodoList>/", this.oReadOnlyToDoTemplate, "Navigation");
					if (!sap.ui.Device.system.phone) {
						oControl.setProperty('/showFooter', false);
					}
				}
			} else if (section == "todolist") {
				// oControl.setProperty('/overviewCancel', false);
				// oControl.setProperty('/sendForApproval', false);
				// oControl.setProperty('/submitDraft', false);
				oControl.setProperty('/currentTodo', true);

				if (!sap.ui.Device.system.phone) {
					oControl.setProperty('/showFooter', false);
				}
				// oControl.setProperty('/todoDone', false);
				// oControl.setProperty('/editTodoVisibility', true);
				oControl.setProperty('/onEdit', "None");
				oControl.setProperty('/duplicateVisibility', false);
				oControl.setProperty('/duplicateWeekVisibility', false);
				// oControl.setProperty('/showFooter', false);
				if (this.oReadOnlyTemplate) {
					this.rebindTableWithTemplate(this.oTable, "TimeData>/", this.oReadOnlyTemplate, "Navigation");
					this.getEnteredHours(false);
					if (!sap.ui.Device.system.phone) {
						oControl.setProperty('/showFooter', false);
					}
				}

			} else if (section == "tasks") {
				oControl.setProperty('/showFooter', false);
				oControl.setProperty('/currentTodo', false);

				// oControl.setProperty('/overviewCancel', false);
				// oControl.setProperty('/sendForApproval', false);
				// oControl.setProperty('/submitDraft', false);
				// oControl.setProperty('/todoDone', false);
				oControl.setProperty('/onEdit', "None");
				if (this.oReadOnlyTemplate) {
					this.rebindTableWithTemplate(this.oTable, "TimeData>/", this.oReadOnlyTemplate, "Navigation");
					this.getEnteredHours(false);
					oControl.setProperty('/showFooter', false);
				}

				// oControl.setProperty('/todoCancel', false);
				oControl.setProperty('/overviewEdit', true);
				// if (!sap.ui.Device.system.phone) {
				oControl.setProperty('/editTodoVisibility', true);
				// }
				oControl.setProperty('/duplicateVisibility', false);
				oControl.setProperty('/duplicateWeekVisibility', false);
				// oControl.setProperty('/todoDone', false);
				if (this.oReadOnlyToDoTemplate) {
					this.rebindTableWithTemplate(this.oToDoTable, "TodoList>/", this.oReadOnlyToDoTemplate, "Navigation");
				}
				oControl.setProperty('/showFooter', false);
			} else {
				oControl.setProperty('/showFooter', false);
				oControl.setProperty('/currentTodo', false);

				// oControl.setProperty('/overviewCancel', false);
				// oControl.setProperty('/sendForApproval', false);
				// oControl.setProperty('/submitDraft', false);
				// oControl.setProperty('/todoDone', false);
				oControl.setProperty('/onEdit', "None");
				if (this.oReadOnlyTemplate) {
					this.rebindTableWithTemplate(this.oTable, "TimeData>/", this.oReadOnlyTemplate, "Navigation");
					this.getEnteredHours(false);

					oControl.setProperty('/showFooter', false);
				}

				// oControl.setProperty('/todoCancel', false);
				oControl.setProperty('/overviewEdit', true);
				// if (!sap.ui.Device.system.phone) {
				oControl.setProperty('/editTodoVisibility', true);
				// }
				oControl.setProperty('/duplicateVisibility', false);
				oControl.setProperty('/duplicateWeekVisibility', false);
				// oControl.setProperty('/todoDone', false);
				if (this.oReadOnlyToDoTemplate) {
					this.rebindTableWithTemplate(this.oToDoTable, "TodoList>/", this.oReadOnlyToDoTemplate, "Navigation");
				}
				oControl.setProperty('/showFooter', false);
			}
			this.setModel(oControl, "controls");
		},
		onValueHelp: function (oEvent) {
			var that = this;
			var FieldName = oEvent.getSource().getCustomData('FieldName')[0].getValue();
			that.FieldName = FieldName;
			var FieldLabel = oEvent.getSource().getCustomData('FieldLabel')[2].getValue();
			var oControl = this.getModel("controls");

			if (that.getModel('controls').getProperty('/currentAdHoc')) {
				if (oEvent.getSource().getId().indexOf("AdHoc_Fields") > 0) {
					that.RelatedFieldName = FieldName;
					that.RelatedValueSource = oEvent.getSource();
					oControl.setProperty("/fieldLabel", FieldLabel);
				} else {
					oControl.setProperty("/fieldLabel1", FieldLabel);
				}
			} else {
				if (oEvent.getSource().getId().indexOf("AdHoc_Todo_Fields") > 0) {
					that.RelatedFieldName = FieldName;
					that.RelatedValueSource = oEvent.getSource();
					oControl.setProperty("/fieldLabel", FieldLabel);

				} else {
					oControl.setProperty("/fieldLabel1", FieldLabel);
				}
			}
			if (that.RelatedFieldName != that.FieldName) {
				that.selectionField1Val = "";
				that.selectionField2val = "";
				that.selectionField3Val = "";
				that.selectionField4Val = "";
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
			var indexOfControl = 0;
			if (this.getModel('controls').getProperty('/currentTodoAdHoc')) {
				indexOfControl = oSource.getId().indexOf("AdHoc_Todo_Fields");
			} else {
				indexOfControl = oSource.getId().indexOf("AdHoc_Fields");
			}
			if (indexOfControl > 0) {
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
								if ((data[1].DispField1Header && data[1].DispField1Header !== "") || (data[1].DispField1Val && data[1].DispField1Val !==
										"")) {
									that.DispField1Header = data[1].DispField1Header;
									columns.push({
										label: seldata.DispField2Text,
										template: "DispField1Val"
									});
								}
								if ((data[1].DispField2Header && data[1].DispField2Header !== "") || (data[1].DispField2Val && data[1].DispField2Val !==
										"")) {
									columns.push({
										label: seldata.DispField3Text,
										template: "DispField2Val"
									});
								}
								if ((data[1].DispField3Header && data[1].DispField3Header !== "") || (data[1].DispField3Val && data[1].DispField3Val !==
										"")) {
									columns.push({
										label: seldata.DispField4Text,
										template: "DispField3Val"
									});
								}
								if ((data[1].DispField4Header && data[1].DispField4Header !== "") || (data[1].DispField4Val && data[1].DispField4Val !==
										"")) {
									columns.push({
										label: data[1].DispField4Header,
										template: "DispField4Val"
									});
								}
								if ((data[1].DispField5Header && data[1].DispField5Header !== "") || (data[1].DispField5Val && data[1].DispField5Val !==
										"")) {
									columns.push({
										label: data[1].DispField5Header,
										template: "DispField5Val"
									});
								}
								if ((data[1].DispField6Header && data[1].DispField6Header !== "") || (data[1].DispField6Val && data[1].DispField6Val !==
										"")) {
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
						if (data1[1].DispField1Header && data1[1].DispField1Header !== "" || (data1[1].DispField1Val && data1[1].DispField1Val !==
								"")) {
							columns.push({
								label: seldata1.SelField2Text,
								template: "DispField1Val"
							});
						}
						if (data1[1].DispField2Header && data1[1].DispField2Header !== "" || (data1[1].DispField2Val && data1[1].DispField2Val !==
								"")) {
							columns.push({
								label: seldata1.SelField3Text,
								template: "DispField2Val"
							});
						}
						if (data1[1].DispField3Header && data1[1].DispField3Header !== "" || (data1[1].DispField3Val && data1[1].DispField3Val !==
								"")) {
							columns.push({
								label: seldata1.SelField4Text,
								template: "DispField3Val"
							});
						}
						if (data1[1].DispField4Header && data1[1].DispField4Header !== "" || (data1[1].DispField4Val && data1[1].DispField4Val !==
								"")) {
							columns.push({
								label: data1[1].DispField4Header,
								template: "DispField4Val"
							});
						}
						if (data1[1].DispField5Header && data1[1].DispField5Header !== "" || (data1[1].DispField5Val && data1[1].DispField5Val !==
								"")) {
							columns.push({
								label: data1[1].DispField5Header,
								template: "DispField5Val"
							});
						}
						if (data1[1].DispField6Header && data1[1].DispField6Header !== "" || (data1[1].DispField6Val && data1[1].DispField6Val !==
								"")) {
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
							if ((seldata1.SelField4Text !== seldata1.SelField3Text) && (seldata1.SelField4Text !== seldata1.SelField2Text) && (
									seldata1
									.SelField4Text !==
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
							if ((seldata1.SelField5Text !== seldata1.SelField4Text) && (seldata1.SelField5Text !== seldata1.SelField3Text) && (
									seldata1
									.SelField5Text !==
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
							if ((seldata1.SelField6Text !== seldata1.SelField5Text) && (seldata1.SelField6Text !== seldata1.SelField4Text) && (
									seldata1
									.SelField6Text !==
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
			var oContainer = this.getModel("AdHocModel").getData().fields;
			//var oFormContainers = this.getModel("EditedTask").getData().containers;
			var oFormContainers = [];
			var oEditedTask = this.getModel("AdHocModel").getData();
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
			this.oDataModel.read(that.appendLocaleParameter('/ValueHelpCollection'), mParameters);
		},
		// handleClick: function (oEvent) {
		// 	var that = this;
		// 	var value = oEvent.getParameter('selectedItem');
		// },
		handleClick: function (oEvent) {
			var value = oEvent.getParameter('tokens');
			// this.oValueHelpSource.setTokens(value);
			this.oValueHelpSource.setValue(value[0].getKey());
			if (this.FieldName === "APPROVER") {
				this.getModel("EditedTask").getData().ApproverName = value[0].getText();
			}
			oEvent.getSource().close();
		},

		onToDoEdit: function (oEvent) {
			var that = this;
			var oModel = this.getModel('controls');
			oModel.setProperty('/sendForApproval', false);
			oModel.setProperty('/sendForApprovalCheck', false);
			oModel.setProperty('/submitDraft', false);
			oModel.setProperty('/overviewCancel', false);
			oModel.setProperty('/todoCancel', true);
			oModel.setProperty('/todoDone', true);
			oModel.setProperty('/todoDoneCheck', this.checkButtonNeeded === "X" ? true : false);
			oModel.setProperty('/showFooter', true);
			oModel.setProperty('/editTodoVisibility', false);
			this.oReadOnlyToDoTemplate = this.getView().byId("idToDoList").removeItem(0);
			this.oEditableToDoTemplate = new sap.m.ColumnListItem({
				highlight: "{TodoList>highlight}",
				cells: [
					new sap.m.Text({
						text: "{path: 'TodoList>TimeEntryDataFields/WORKDATE', type: 'sap.ui.model.type.Date', formatOptions: { style: 'full' }}"
					}),
					new sap.m.Link({
						text: {
							parts: [{
								path: 'TodoList>total',
								type: 'sap.ui.model.odata.type.Decimal',
								formatOptions: {
									parseAsString: true,
									decimals: 2,
									maxFractionDigits: 2,
									minFractionDigits: 0
								},
								constraints: {
									precision: 4,
									scale: 2,
									minimum: '0',
									maximum: '10000'
								}
							}, {
								path: 'TodoList>target',
								type: 'sap.ui.model.odata.type.Decimal',
								formatOptions: {
									parseAsString: true,
									decimals: 2,
									maxFractionDigits: 2,
									minFractionDigits: 0
								},
								constraints: {
									precision: 4,
									scale: 2,
									minimum: '0',
									maximum: '10000'
								}
							}],
							formatter: formatter.concatStrings
						},
						press: this.handleRecordedVsTargetLinkPress.bind(this)

					}),

					new sap.m.ObjectStatus({
						text: {
							path: 'TodoList>currentMissing',
							type: 'sap.ui.model.odata.type.Decimal',
							formatOptions: {
								parseAsString: true,
								decimals: 2,
								maxFractionDigits: 2,
								minFractionDigits: 0
							},
							constraints: {
								precision: 4,
								scale: 2,
								minimum: '0',
								maximum: '10000'
							}
						}

					}),

					new sap.m.ComboBox({
						selectedKey: "{TodoList>AssignmentId}",
						selectionChange: this.onSelectionChangeToDo.bind(this),
						placeholder: {
							parts: [{
								path: 'TodoList>Status'
							}, {
								path: 'TodoList>AssignmentName'
							}, {
								path: 'TodoList>target'
							}, {
								path: 'TodoList>AssignmentId'
							}, {
								path: 'textBundle>/ApprovedLeave'
							}, {
								path: 'textBundle>/assignmentSelection'
							}, {
								path: 'textBundle>/noAssignment'
							}],
							formatter: this.formatter.getPlaceHolder
						},
						showSecondaryValues: true,
						tooltip: {
							path: 'TodoList>AssignmentId',
							formatter: this.formatter.getTooltip.bind(this)
						}
					}).bindItems({
						path: "TasksWithGroups>/",
						// sorter: new sap.ui.model.Sorter("AssignmentName", false, false, function (sVal1, sVal2) {
						// 	if (sVal1 > sVal2) {
						// 		return 1;
						// 	}
						// 	return -1;
						// }),
						// factory: this.activeTasks,
						template: new sap.ui.core.ListItem({
							key: "{TasksWithGroups>AssignmentId}",
							text: "{TasksWithGroups>AssignmentName}",
							enabled: {
								parts: [{
									path: 'TasksWithGroups>AssignmentStatus'
								}, {
									path: 'TasksWithGroups>ValidityStartDate'
								}, {
									path: 'TasksWithGroups>ValidityEndDate'
								}, {
									path: 'TodoList>TimeEntryDataFields'
								}],
								formatter: this.formatter.activeTasks
							},
							additionalText: "{TasksWithGroups>AssignmentType}"
						}),
						templateShareable: true
					}).addEventDelegate({
						onfocusin: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', false);
							}
						},
						onfocusout: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', true);
							}
						}
					}),
					new sap.m.Button({

						icon: "sap-icon://edit-outside",
						type: "Transparent",
						tooltip: this.formEntryName,
						press: this.loadAdHocTodoFragment.bind(this),
						visible: this.getModel('controls').getProperty('/isFormEntryEnabled')

					}),
					// new sap.ui.layout.HorizontalLayout({
					// 	content: [new sap.m.Input({
					// 		value: "{TodoList>TimeEntryDataFields/CATSHOURS}",
					// 		type: sap.m.InputType.Number,
					// 		width: "60%",
					// 		liveChange: this.liveChangeHoursToDo.bind(this)
					// 	}), new sap.m.Text({
					// 		text: "{TodoList>TimeEntryDataFields/UNIT}"
					// 	})]
					// }),
					new sap.ui.layout.HorizontalLayout({
						content: [
							// new sap.m.Input({
							// 	value: "{TodoList>TimeEntryDataFields/CATSHOURS}",
							// 	description: {
							// 		parts: [{
							// 			path: 'TodoList>TimeEntryDataFields/UNIT'
							// 		}, {
							// 			path: 'TodoList>TimeEntryDataFields/CATSHOURS'
							// 		}],
							// 		formatter: formatter.getUnitTexts.bind(this)
							// 	},
							// 	liveChange: this.liveChangeHoursToDo.bind(this),
							// 	type: sap.m.InputType.Number,
							// 	width: "100%",
							// 	fieldWidth: "60%"
							// })
							new sap.m.StepInput({
								value: {
									parts: [{
										path: 'TodoList>TimeEntryDataFields/CATSHOURS'
									}, {
										path: 'TodoList>TimeEntryDataFields/CATSQUANTITY'
									}, {
										path: 'TodoList>TimeEntryDataFields/CATSAMOUNT'
									}],
									formatter: formatter.calHoursQuanAmountInput.bind(this)
								},
								description: {
									parts: [{
										path: 'TodoList>TimeEntryDataFields/UNIT'
									}, {
										path: 'TodoList>TimeEntryDataFields/CATSHOURS'
									}],
									formatter: formatter.getUnitTexts.bind(this)
								},
								change: this.liveChangeHoursToDo.bind(this),
								displayValuePrecision: 2,
								validationMode: "LiveChange",
								step: 1,
								min: 0,
								tooltip: "",
								fieldWidth: "60%",
								valueState: "{TodoList>valueState}",
								valueStateText: "{TodoList>valueStateText}",
								enabled: {
									parts: [{
										path: 'TodoList>Status'
									}, {
										path: 'controls>/hoursDisabled'
									}],
									formatter: this.formatter.checkHrRecord.bind(this)
								}
							}).addEventDelegate({
								validation: function (oEvent) {
									try {
										if (parseFloat(oEvent.srcControl.getValue()) >= 0.0) {
											that.getModel("controls").setProperty("/todoDataChangedWithCheck", true);
											//this.byId("ToDoCheckButton").setVisible(true);

										}
									} catch (exception) {

									}
								},
								onfocusin: function (oEvent) {
									if (sap.ui.Device.system.phone == true) {
										that.getModel('controls').setProperty('/showFooter', false);
									}
								},
								onfocusout: function (oEvent) {
									if (sap.ui.Device.system.phone == true) {
										that.getModel('controls').setProperty('/showFooter', true);
									}
								},
								onsapup: function (oEvent) {
									this.validation(oEvent);
								},
								onkeyup: function (oEvent) {
									try {
										if (parseFloat(oEvent.srcControl.getValue()) > 0.0) {
											that.getModel("controls").setProperty("/todoDataChangedWithCheck", true);
											//this.byId("ToDoCheckButton").setVisible(true);

										}
									} catch (exception) {

									}
								},
								onsapdown: function (oEvent) {
									this.validation(oEvent);
								}

							})
							// 	, 
							// 	new sap.m.Label({
							// 		text: "{TimeData>TimeEntryDataFields/UNIT}",
							// 		style: "Bold"
						]
					}),
					new sap.m.CheckBox({
						selected: "{TodoList>SetDraft}",
						visible: this.draftStatus,
						enabled: {
							path: 'TodoList>TimeEntryDataFields/STATUS',
							formatter: this.formatter.checkHrRecord.bind(this)
						}
					}).attachSelect(this.onSelectionDraftToDo.bind(this)),
					new sap.m.TimePicker({
						value: {
							parts: [{
									path: 'TodoList>TimeEntryDataFields/BEGUZ'
								}, {
									path: 'TodoList>TimeEntryDataFields/ENDUZ'
								}

							],

							formatter: this.formatter.formatTableTimeStart.bind(this)
						},
						visible: this.clockTimeVisible,
						valueFormat: "HH:mm",
						displayFormat: sap.ui.core.format.DateFormat.getTimeInstance({
							style: "short"
						}).oFormatOptions.pattern,
						change: this.startTimeToDoChange.bind(this),
						placeholder: this.oBundle.getText("startTime")
					}).addEventDelegate({
						onfocusin: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', false);
							}
						},
						onfocusout: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', true);
							}
						}
					}),
					new sap.m.TimePicker({
						value: {
							parts: [{
									path: 'TodoList>TimeEntryDataFields/BEGUZ'
								}, {
									path: 'TodoList>TimeEntryDataFields/ENDUZ'
								}

							],

							formatter: this.formatter.formatTableTimeEnd.bind(this)
						},
						visible: this.clockTimeVisible,
						valueFormat: "HH:mm",
						displayFormat: sap.ui.core.format.DateFormat.getTimeInstance({
							style: "short"
						}).oFormatOptions.pattern,
						change: this.stopTimeToDoChange.bind(this),
						placeholder: this.oBundle.getText("endTime")
					}).addEventDelegate({
						onfocusin: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', false);
							}
						},
						onfocusout: function (oEvent) {
							if (sap.ui.Device.system.phone == true) {
								that.getModel('controls').setProperty('/showFooter', true);
							}
						}
					}),
					new sap.m.CheckBox({
						selected: {
							path: 'TodoList>TimeEntryDataFields/VTKEN',
							formatter: formatter.checkPrevDay
						},
						visible: this.previousDayIndicator,
						editable: this.previousDayIndicatorEdit
							// enabled: {
							// 	path: True,
							// 	formatter: this.formatter.checkHrRecord.bind(this)
							// }
					}).attachSelect(this.onToDoPreviousDayIndicator.bind(this)),
					new sap.m.ObjectStatus({
						text: {
							path: 'TodoList>TimeEntryDataFields/STATUS',
							formatter: formatter.status
						},
						state: {
							path: 'TodoList>TimeEntryDataFields/STATUS',
							formatter: formatter.TodoState
						}
					}),
					new sap.m.Button({
						icon: {
							path: 'TodoList>TimeEntryDataFields/LONGTEXT',
							formatter: formatter.longtextButtons
						},
						tooltip: this.getModel("i18n").getResourceBundle().getText('comment'),
						type: sap.m.ButtonType.Transparent,
						press: this.EditTodoLongTextPopover.bind(this)

					}),

					new sap.ui.layout.HorizontalLayout({
						content: [
							// new sap.m.Button({
							// 	icon: {
							// 		path: 'TodoList>TimeEntryDataFields/LONGTEXT',
							// 		formatter: formatter.longtextButtons
							// 	},
							// 	tooltip: this.getModel("i18n").getResourceBundle().getText('comment'),
							// 	type: sap.m.ButtonType.Transparent,
							// 	press: this.EditTodoLongTextPopover.bind(this)

							// }),
							new sap.m.Button({
								icon: "sap-icon://sys-cancel",
								type: sap.m.ButtonType.Transparent,
								press: this.onTodoDeleteRow.bind(this),
								tooltip: this.getModel("i18n").getResourceBundle().getText('deleteRow'),
								visible: "{TodoList>deleteButton}",
								enabled: "{TodoList>deleteButtonEnable}"
							}),
							new sap.m.Button({
								icon: "sap-icon://add",
								type: sap.m.ButtonType.Transparent,
								press: this.onTodoAddRow.bind(this),
								visible: "{TodoList>addButton}",
								enabled: "{TodoList>addButtonEnable}"
							})
						]
					}),
					new sap.m.Text({
						text: {
							parts: [{
								path: 'TodoList>TimeEntryDataFields'
							}, {
								path: 'ToDoAttributes>/state'
							}],
							formatter: formatter.ConcatenateTodoText.bind(this)
						}
					})
				],
				customData: [new sap.ui.core.CustomData({
					key: "counter",
					value: "{TodoList>Counter}"
				})]
			});
			/**
			 * @ControllerHook Modify or add columns to the Todolist table in edit mode
			 * This hook method can be used to modify the object before the post call
			 * It is called when the decision options for the detail item are fetched successfully
			 * @callback hcm.mytimesheet.view.S3~extHookOnEditTodo
			 * @param {object} Post Object
			 * @return {object} Final Post Object
			 */
			if (this.extHookOnEditTodo) {
				this.oEditableToDoTemplate = this.extHookOnEditTodo(this.oEditableToDoTemplate);
			}
			this.rebindTableWithTemplate(this.oToDoTable, "TodoList>/", this.oEditableToDoTemplate, "Edit");

		},
		liveChangeHoursToDoAdHoc: function (oEvent) {

			var checkChange = false;
			var val = /^\d+(\.\d{1,2})?$/;
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/todoDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/todoDataChanged", false);
				this.getModel("controls").setProperty("/todoDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isToDoChanged", true);
				this.getModel("controls").setProperty("/todoDataChanged", true);
			}
			sap.ushell.Container.setDirtyFlag(true);
			this.successfulToDoCheck = "";
			// if (parseFloat(oEvent.getSource().getValue())) {
			if (val.test(oEvent.getSource().getValue())) {

				var counter = this.getModel('controls').getProperty("/adHocCounter");

				var oModel = this.oToDoTable.getModel('TodoList');
				var customData = oEvent.getSource().getCustomData('GroupPosition')[0].getValue();
				customData.FieldValue = parseFloat(oEvent.getSource().getValue());

				var index = this.getModel("controls").getProperty("/index");
				var data = oModel.getData();
				if (data[index].addButtonEnable === false) {
					checkChange = true;
				}
				data[index].addButtonEnable = true;
				data[index].deleteButtonEnable = true;
				data[index].sendButton = true;
				data[index].TimeEntryDataFields.CATSHOURS = parseFloat(oEvent.getSource().getValue()).toFixed(2);
				// data[index].total = ((parseFloat(data[index].target) - parseFloat(data[index].missing)) + parseFloat(oEvent.getSource().getValue()))
				// 	.toFixed(2);
				if (counter && counter !== null) {
					data[index].TimeEntryOperation = 'U';
				} else {
					data[index].TimeEntryOperation = 'C';
				}
				if ((data[index].Status === "40" || data[index].Status === "10") && (checkChange === true)) {
					data[index].missing = data[index].target - data[index].total;
				}
				data = this.calculateSumToDo(new Date(data[index].TimeEntryDataFields.WORKDATE), data);
				oModel.refresh();
				this.getModel('adHocTodoTotalTarget').getData()[0].recorded = parseFloat(data[index].total);
				this.getModel('adHocTodoTotalTarget').getData()[0].recorded.toFixed(2);
				this.getModel('adHocTodoTotalTarget').refresh();

			}
		},

		liveChangeHoursToDo: function (oEvent) {
			var checkChange = false;
			var val = /^\d+(\.\d{1,2})?$/;
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/todoDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isToDoChanged", false);
				this.getModel("controls").setProperty("/todoDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isToDoChanged", true);
				this.getModel("controls").setProperty("/todoDataChanged", true);
			}
			sap.ushell.Container.setDirtyFlag(true);
			this.successfulToDoCheck = "";
			// if (parseFloat(oEvent.getSource().getValue())) {
			if (val.test(oEvent.getSource().getValue())) {
				var counter = oEvent.getSource().getParent().getParent().getCustomData('counter')[0].getValue();
				var oModel = this.oToDoTable.getModel('TodoList');
				var index = parseInt(oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1]);
				var data = oModel.getData();
				if (data[index].addButtonEnable === false) {
					checkChange = true;
				}
				data[index].addButtonEnable = true;
				data[index].deleteButtonEnable = true;
				data[index].sendButton = true;
				data[index].TimeEntryDataFields.CATSHOURS = parseFloat(oEvent.getSource().getValue()).toFixed(2);
				// data[index].total = ((parseFloat(data[index].target) - parseFloat(data[index].missing)) + parseFloat(oEvent.getSource().getValue()))
				// 	.toFixed(2);
				if (counter && counter !== null) {
					data[index].TimeEntryOperation = 'U';
				} else {
					data[index].TimeEntryOperation = 'C';
				}
				if ((data[index].Status === "40" || data[index].Status === "10") && (checkChange === true)) {
					data[index].missing = data[index].target - data[index].total;
				}
				data = this.calculateSumToDo(new Date(data[index].TimeEntryDataFields.WORKDATE), data);
				oModel.refresh();
				// this.setFocusFixedElement();
				// this.setModel(new JSONModel(data), "TodoList");
				// var item = $.grep(this.oToDoTable.getItems(), function (element, index) {
				// 	if (!element.getAggregation('cells')) {
				// 		return false;
				// 	} else {
				// 		return true;
				// 	}
				// });
				// item[index].focus();
			}
		},
		onCopyTask: function (oEvent) {
			var that = this;
			var oView = this.getView();
			var oTable = this.byId('idTasks');
			var oModel = new JSONModel();
			var data = this.getModel('ProfileFields').getData();
			var tasks = this.getModel('Tasks').getData();
			var index = oTable.getSelectedItem().getBindingContext('TaskFields').getPath().split("/")[1];
			var formElements = [];
			var formContainers = [];
			var form = {
				name: null,
				status: false,
				containers: null
			};
			var oControl = this.getModel("controls");
			oControl.setProperty('/createAssignment', true);
			oControl.setProperty('/editAssignment', false);
			oControl.setProperty('/copyAssignment', true);
			oControl.setProperty('/displayAssignment', false);
			oControl.setProperty('/editAssignmentCancel', true);
			oControl.setProperty('/displayAssignmentCancel', false);
			oControl.setProperty('/assignmentTitle', this.oBundle.getText("copyAssignment"));
			this.setGlobalModel(oControl, "controls");
			var selectedTask = oTable.getSelectedItem().getAggregation('cells');
			var profileFields = $.extend(true, [], this.getModel('ProfileFields').getData());
			for (var i = 0; i < selectedTask.length; i++) {
				var obj = $.grep(data, function (element, index) {
					return element.FieldName == selectedTask[i].getCustomData('FieldName')[0].getValue();
				});
				if (selectedTask[i].getCustomData('FieldName')[0].getValue() !== "AssignmentStatus" && selectedTask[i].getCustomData(
						'FieldName')[
						0].getValue() !== "AssignmentName" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityStartDate" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityEndDate") {
					if (tasks[index].AssignmentFields[selectedTask[i].getCustomData('FieldName')[0].getValue()] !== undefined) {
						obj[0].FieldValue = tasks[index].AssignmentFields[selectedTask[i].getCustomData('FieldName')[0].getValue()];
					}
					obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
				} else {
					if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentStatus") {
						obj[0].FieldValue = selectedTask[i].getAggregation('customData')[2].getValue();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentName") {
						// obj[0].FieldValue = selectedTask[i].getText();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
						obj[0].FieldValue = "";
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityStartDate") {
						obj[0].FieldValue = selectedTask[i].getAggregation('customData')[2].getValue();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityEndDate") {
						obj[0].FieldValue = selectedTask[i].getAggregation('customData')[2].getValue();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					}
				}
				if (selectedTask[i].getCustomData('FieldName')[0].getValue() !== "AssignmentName" && selectedTask[i].getCustomData('FieldName')[
						0]
					.getValue() !== "AssignmentStatus" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityStartDate" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityEndDate") {
					formElements.push(obj[0]);
				} else {
					if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentName") {
						form.name = obj[0].FieldValue;
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentStatus") {
						form.status = obj[0].FieldValue;
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityStartDate") {
						form.validFrom = new Date(obj[0].FieldValue);
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityEndDate") {
						form.validTo = new Date(obj[0].FieldValue);
					}
				}
				if (formElements.length >= 1) {
					formContainers.push({
						form: $.extend(formElements, [], true)
					});
					formElements = [];
				}
			}
			form.containers = formContainers;
			var oField = {
				fields: [],
				name: null,
				status: false

			};
			// form.formElements = formElements;
			oModel.setData(form);
			this.setGlobalModel(oModel, "EditedTask");
			this.createGroupingOfFields(formContainers, oField);

			this.setGlobalModel(new JSONModel(oField), "EditedTask1");
			this.getRouter().navTo("editAssignment", {}, false);
		},
		onSendForApprovalToDo: function (oEvent) {
			var that = this;
			// this.showBusy();
			var index = parseInt(oEvent.getSource().getBindingContext('TodoList').getPath().split('/')[1]);
			var oModel = this.getModel("TodoList");
			var oAprModel = this.getModel("TodoListApproval");
			var aprData;
			var data = oModel.getData();
			if (oAprModel) {
				aprData = oAprModel.getData();
				aprData.push(data[index]);
			} else {
				aprData = [data[index]];
				oAprModel = new JSONModel();
			}
			oAprModel.setData(aprData);
			this.setModel(oAprModel, "TodoListApproval");
			data.splice(index, 1);
			oModel.setData(data);
			this.setModel(oModel, "TodoList");
			var toastMsg = that.oBundle.getText("todoEntriesSaved");
			sap.m.MessageToast.show(toastMsg, {
				duration: 2000
			});
		},
		onCheckEntriesToDo: function (submitTrue) {
			var that = this;
			this.showBusy();
			var submitEntries = this.fetchToDoRecords("X");
			var oTodoData = this.getModel('TodoList').getData();
			for (var i = 0; i < oTodoData.length; i++) {
				oTodoData[i].valueState = "None";
				oTodoData[i].highlight = "None";
			}
			var oModel = $.extend(true, {}, this.oDataModel);
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
					function (oData) {
						if (submitEntries.length === 0) {
							that.hideBusy(true);
							var toastMsg = that.oBundle.getText("noEntriesToSubmit");
							sap.m.MessageToast.show(toastMsg, {
								duration: 3000
							});
							sap.ui.getCore().getMessageManager().removeAllMessages();
							that.byId("ToDoSubmitButton").setEnabled(false);
							if (that.checkButtonNeeded === "X") {
								that.byId("ToDoCheckButton").setEnabled(false);
							}
							return;
						}
						for (var i = 0; i < submitEntries.length; i++) {
							var obj = {
								properties: submitEntries[i],
								changeSetId: "TimeEntry",
								groupId: "TimeEntry"
							};
							oModel
								.createEntry(
									that.appendLocaleParameter("/TimeEntryCollection"),
									obj);
						}
						oModel.submitChanges({
							groupId: "TimeEntry",
							changeSetId: "TimeEntry",
							success: function (oData, res) {
								if (that.oMessagePopover) {
									that.oMessagePopover.destroy();
									sap.ui.getCore().getMessageManager().removeAllMessages();
								}
								var error = false;
								var warning = false;
								var errorVeto = false;
								var warningVeto = false;
								var errorJSON;
								var mText = "";
								var mTextAll = "";
								var entries = that.getModel('TodoList').getData();
								var oMessages = [];
								if (!oData.__batchResponses[0].__changeResponses) {
									var messageText = "";
									var messageType = "";
									errorJSON = JSON.parse(oData.__batchResponses[0].response.body);
									var totalLength = errorJSON.error.innererror.errordetails.length - 1;
									sap.ui.getCore().getMessageManager().removeAllMessages();
									// Additional coding to handle error message(s)
									for (var len = 0; len < totalLength; len++) {
										messageText = errorJSON.error.innererror.errordetails[len].message;
										messageType = errorJSON.error.innererror.errordetails[len].severity;
										if (messageType == "warning") {
											sap.ui.getCore().getMessageManager().addMessages(
												new sap.ui.core.message.Message({
													message: messageText,
													description: messageText,
													type: sap.ui.core.MessageType.Warning,
													processor: that.getOwnerComponent().oMessageProcessor,
													code: "TodoList"
												}));
										} else {
											sap.ui.getCore().getMessageManager().addMessages(
												new sap.ui.core.message.Message({
													message: messageText,
													description: messageText,
													type: sap.ui.core.MessageType.Error,
													processor: that.getOwnerComponent().oMessageProcessor,
													code: "TodoList"
												}));
											error = true;
										}
									}
									//if message type is error then add the last error message
									if (!errorJSON.error.innererror.errordetails[len].code.match("/IWBEP")) {
										messageText = errorJSON.error.innererror.errordetails[len].message;
										sap.ui.getCore().getMessageManager().addMessages(
											new sap.ui.core.message.Message({
												message: messageText,
												description: messageText,
												type: sap.ui.core.MessageType.Error,
												processor: that.getOwnerComponent().oMessageProcessor,
												code: "TodoList"
											}));
										error = true;
									}
									that.hideBusy(true);
								} else {
									for (var i = 0; i < oData.__batchResponses[0].__changeResponses.length; i++) {
										var entry = $.grep(entries, function (element, ind) {
											if (element.RecRowNo) {
												return element.RecRowNo === parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo).toString();
											}
										});
										if (entry.length > 0) {

											var counter = entry[0].Counter;
											if (counter && counter !== null) {
												entry[0].TimeEntryOperation = 'U';
											} else {
												entry[0].TimeEntryOperation = 'C';
											}
											entry[0].TimeEntryDataFields.CATSHOURS = parseFloat(oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields
												.CATSHOURS).toFixed(2);
											if (entry[0].TimeEntryDataFields.CATSHOURS === "0.00" && entry[0].TimeEntryDataFields.CATSQUANTITY !== "") {
												entry[0].TimeEntryDataFields.CATSHOURS = parseFloat(oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields
													.CATSQUANTITY).toFixed(2);
											}
											entry[0].TimeEntryDataFields.CATSQUANTITY = parseFloat(oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields
												.CATSQUANTITY).toFixed(3);
											entry[0].TimeEntryDataFields.BEGUZ = oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields.BEGUZ;
											entry[0].TimeEntryDataFields.ENDUZ = oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields.ENDUZ;
											that.calculateSumToDo(new Date(oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields.WORKDATE),
												that.getModel('TodoList').getData());
											if (that.oEditableToDoTemplate) {
												that.rebindTableWithTemplate(that.oToDoTable, "TodoList>/", that.oEditableToDoTemplate, "Edit");
											}
										}
										error = warning = false;
										if (oData.__batchResponses[0].__changeResponses[i].data.Message1 !== "" || oData.__batchResponses[0].__changeResponses[
												i]
											.data.CustomMessage !== "" || oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg !== "") {
											var messageClass = oData.__batchResponses[0].__changeResponses[i].data.MessageClass1;
											var messageNumber = oData.__batchResponses[0].__changeResponses[i].data.MessageNumber1;

											var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
												style: 'long'
											});

											if (messageClass === 'LR' && messageNumber === "201") {
												oData.__batchResponses[0].__changeResponses[i].data.Message1 = oDateFormat
													.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + that.oBundle.getText("collisionMessage");

											} else if (messageClass === 'LR' && messageNumber === "206") {
												oData.__batchResponses[0].__changeResponses[i].data.Message1 = oDateFormat
													.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + that.oBundle.getText("extraHoursMessage");
											} else if (messageClass === 'LR' && messageNumber === "205") {
												oData.__batchResponses[0].__changeResponses[i].data.Message1 = oDateFormat
													.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + that.oBundle.getText("lessHoursMessage");
											} else {
												oData.__batchResponses[0].__changeResponses[i].data.Message1 = oDateFormat
													.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + oData.__batchResponses[0].__changeResponses[i].data
													.Message1;
											}

											switch (oData.__batchResponses[0].__changeResponses[i].data.Message1Type) {

											case "E":
												errorVeto = true;
												if (entry.length > 0) {
													//	entry[0].valueState = "Error";
													entry[0].highlight = "Error";
													//	entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message1;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														description: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														type: sap.ui.core.MessageType.Error,
														processor: that.getOwnerComponent().oMessageProcessor,
														additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
														code: "TodoList"
													}));
												}
												break;
											case "W":
												warning = true;
												warningVeto = true;
												if (entry.length > 0) {
													//	entry[0].valueState = "Warning";
													entry[0].highlight = "Warning";
													//	entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message1;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														description: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														type: sap.ui.core.MessageType.Warning,
														processor: that.getOwnerComponent().oMessageProcessor,
														additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
														code: "TodoList"
													}));
												}
												break;
											case "I":
												if (entry.length > 0) {
													//		entry[0].valueState = "Information";
													entry[0].highlight = "Information";
													//		entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message1;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														description: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														type: sap.ui.core.MessageType.Information,
														processor: that.getOwnerComponent().oMessageProcessor,
														additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
														code: "TodoList"
													}));
												}
												break;
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.Message2 !== "") {
												var messageClass = oData.__batchResponses[0].__changeResponses[i].data.MessageClass2;
												var messageNumber = oData.__batchResponses[0].__changeResponses[i].data.MessageNumber2;

												var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
													style: 'long'
												});
												if (messageClass === 'LR' && messageNumber === "201") {
													oData.__batchResponses[0].__changeResponses[i].data.Message2 = oDateFormat
														.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + that.oBundle.getText("collisionMessage");

												} else if (messageClass === 'LR' && messageNumber === "206") {
													oData.__batchResponses[0].__changeResponses[i].data.Message2 = oDateFormat
														.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + that.oBundle.getText("extraHoursMessage");
												} else if (messageClass === 'LR' && messageNumber === "205") {
													oData.__batchResponses[0].__changeResponses[i].data.Message2 = oDateFormat
														.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + that.oBundle.getText("lessHoursMessage");
												} else {
													oData.__batchResponses[0].__changeResponses[i].data.Message2 = oDateFormat
														.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + oData.__batchResponses[0].__changeResponses[i].data
														.Message2;
												}
												switch (oData.__batchResponses[0].__changeResponses[i].data.Message2Type) {
												case "E":
													errorVeto = true;
													if (entry.length > 0) {
														if (entry[0].valueState != "Error") {
															//				entry[0].valueState = "Error";
															entry[0].highlight = "Error";
															//				entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message2;
														}
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															type: sap.ui.core.MessageType.Error,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TodoList"
														}));
													}
													break;
												case "W":
													warning = true;
													warningVeto = true;
													if (entry.length > 0) {
														if (entry[0].valueState != "Error" && entry[0].valueState != "Warning") {
															//			entry[0].valueState = "Warning";
															entry[0].highlight = "Warning";
															//			entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message2;
														}
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															type: sap.ui.core.MessageType.Warning,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TodoList"
														}));
													}
													break;
												case "I":
													if (entry.length > 0) {
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															type: sap.ui.core.MessageType.Information,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TodoList"
														}));
													}
													break;
												}
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.Message3 !== "") {
												var messageClass = oData.__batchResponses[0].__changeResponses[i].data.MessageClass3;
												var messageNumber = oData.__batchResponses[0].__changeResponses[i].data.MessageNumber3;

												var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
													style: 'long'
												});
												if (messageClass === 'LR' && messageNumber === "201") {
													oData.__batchResponses[0].__changeResponses[i].data.Message3 = oDateFormat
														.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + that.oBundle.getText("collisionMessage");

												} else if (messageClass === 'LR' && messageNumber === "206") {
													oData.__batchResponses[0].__changeResponses[i].data.Message3 = oDateFormat
														.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + that.oBundle.getText("extraHoursMessage");
												} else if (messageClass === 'LR' && messageNumber === "205") {
													oData.__batchResponses[0].__changeResponses[i].data.Message3 = oDateFormat
														.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + that.oBundle.getText("lessHoursMessage");
												} else {
													oData.__batchResponses[0].__changeResponses[i].data.Message3 = oDateFormat
														.format(new Date(entry[0].TimeEntryDataFields.WORKDATE)) + ": " + oData.__batchResponses[0].__changeResponses[i].data
														.Message3;
												}
												switch (oData.__batchResponses[0].__changeResponses[i].data.Message3Type) {
												case "E":
													errorVeto = true;
													if (entry.length > 0) {
														if (entry[0].valueState != "Error") {
															//	entry[0].valueState = "Error";
															entry[0].highlight = "Error";
															//	entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message3;
														}
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															type: sap.ui.core.MessageType.Error,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TodoList"
														}));
													}
													break;
												case "W":
													warning = true;
													warningVeto = true;
													if (entry.length > 0) {
														if (entry[0].valueState != "Error" && entry[0].valueState != "Warning") {
															//		entry[0].valueState = "Warning";
															entry[0].highlight = "Warning";
															//		entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message3;
														}
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															type: sap.ui.core.MessageType.Warning,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TodoList"
														}));
													}
													break;
												case "I":
													if (entry.length > 0) {
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															type: sap.ui.core.MessageType.Information,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TodoList"
														}));
													}
													break;
												}
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg !== "") {
												var messageClass = oData.__batchResponses[0].__changeResponses[i].data.ErrorMessageClass;
												var messageNumber = oData.__batchResponses[0].__changeResponses[i].data.ErrorMessageNumber;

												var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
													style: 'long'
												});
												if (messageClass === 'LR' && messageNumber === "201") {
													oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg = that.oBundle.getText("collisionMessage");

												} else if (messageClass === 'LR' && messageNumber === "206") {
													oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg = that.oBundle.getText("extraHoursMessage");
												} else if (messageClass === 'LR' && messageNumber === "205") {
													oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg = that.oBundle.getText("lessHoursMessage");
												} else {
													oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg = oData.__batchResponses[0].__changeResponses[i].data
														.ErrorMsg;
												}
												errorVeto = true;
												oMessages.push(new sap.ui.core.message.Message({
													message: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
													description: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
													type: sap.ui.core.MessageType.Error,
													processor: that.getOwnerComponent().oMessageProcessor,
													code: "TodoList"
												}));
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.CustomMessage !== "") {
												switch (oData.__batchResponses[0].__changeResponses[i].data.CustomMessageType) {
												case "E":
													errorVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														type: sap.ui.core.MessageType.Error,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TodoList"
													}));
													break;
												case "W":
													warning = true;
													warningVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														type: sap.ui.core.MessageType.Warning,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TodoList"
													}));
													break;
												case "I":
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														type: sap.ui.core.MessageType.Information,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TodoList"
													}));
													break;
												}
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1 !== "") {
												switch (oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1Type) {
												case "E":
													errorVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														type: sap.ui.core.MessageType.Error,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TodoList"
													}));
													break;
												case "W":
													warning = true;
													warningVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														type: sap.ui.core.MessageType.Warning,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TodoList"
													}));
													break;
												case "I":
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														type: sap.ui.core.MessageType.Information,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TodoList"
													}));
													break;
												}
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2 !== "") {
												switch (oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2Type) {
												case "E":
													errorVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														type: sap.ui.core.MessageType.Error,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TodoList"
													}));
													break;
												case "W":
													warning = true;
													warningVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														type: sap.ui.core.MessageType.Warning,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TodoList"
													}));
													break;
												case "I":
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														type: sap.ui.core.MessageType.Information,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TodoList"
													}));
													break;
												}
											}

										}
									}
								}
								// } else if (oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg !== "") {
								// 	errorJSON = JSON.parse(oData.__batchResponses[0].__changeResponses[0].headers["sap-message"]);
								// 	if (errorJSON.severity === "error") {
								// 		error = true;
								// 		errorVeto = true;
								// 	} else if (errorJSON.severity === "warning") {
								// 		warning = true;
								// 		warningVeto = true;
								// 	}
								// 	if (entry.length > 0) {
								// 		if (error === true) {
								// 			entry[0].valueState = "Error";
								// 			entry[0].highlight = "Error";
								// 			entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
								// 			mText = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
								// 			oMessages.push(new sap.ui.core.message.Message({
								// 				message: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 				description: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 				type: sap.ui.core.MessageType.Error,
								// 				processor: that.getOwnerComponent().oMessageProcessor,
								// 				additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
								// 				code: "TodoList"
								// 			}));
								// 		} else if (warning === true) {
								// 			entry[0].valueState = "Warning";
								// 			entry[0].highlight = "Warning";
								// 			entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
								// 			mText = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
								// 			oMessages.push(new sap.ui.core.message.Message({
								// 				message: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 				description: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 				type: sap.ui.core.MessageType.Warning,
								// 				processor: that.getOwnerComponent().oMessageProcessor,
								// 				additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
								// 				code: "TodoList"
								// 			}));
								// 		}
								// 	}
								// 	mTextAll = mTextAll + "\n" + mText;
								// } else {
								// 	if (entry.length > 0) {
								// 		entry[0].valueState = "Success";
								// 		entry[0].highlight = "Success";
								// 	}
								// }
								// 	}
								// }
								sap.ui.getCore().getMessageManager().removeAllMessages();
								sap.ui.getCore().getMessageManager().addMessages(
									oMessages
								);
								var toastMsg;
								var messageTitle;
								var messageTitleText;
								if (errorVeto === false && warningVeto === false) {
									that.successfulToDoCheck = "X";
									if (submitTrue === true) {
										that.onToDoSubmit();
									} else {
										that.getModel('TodoList').updateBindings();
										toastMsg = that.oBundle.getText("noErrors");
										that.byId("ToDoSubmitButton").setEnabled(true);
										if (that.checkButtonNeeded === "X") {
											that.byId("ToDoCheckButton").setEnabled(false);
										}
										sap.m.MessageToast.show(toastMsg, {
											duration: 3000
										});
										that.getModel('TodoList').updateBindings();
									}
								} else if (errorVeto === false && warningVeto === true) {
									that.successfulToDoCheck = "X";
									// if (submitTrue === true) {
									// 	that.onToDoSubmit();
									// } else {
									messageTitle = that.oBundle.getText("warnings");
									messageTitleText = that.oBundle.getText("checkResultedWarnings");
									sap.m.MessageBox.warning(messageTitleText, {
										title: messageTitle,
										styleClass: "sapUiResponsivePadding--header sapUiResponsivePadding--content sapUiResponsivePadding--footer",
										onClose: that.getModel('TodoList').updateBindings()
									});
									that.byId("ToDoSubmitButton").setEnabled(true);
									if (that.checkButtonNeeded === "X") {
										that.byId("ToDoCheckButton").setEnabled(false);
									}
									// }
								} else {
									messageTitle = that.oBundle.getText("errors");
									messageTitleText = that.oBundle.getText("checkResultedErrors");
									sap.m.MessageBox.error(messageTitleText, {
										title: messageTitle,
										styleClass: "sapUiResponsivePadding--header sapUiResponsivePadding--content sapUiResponsivePadding--footer",
										onClose: that.getModel('TodoList').updateBindings()
									});
									that.byId("ToDoSubmitButton").setEnabled(false);
									if (that.checkButtonNeeded === "X") {
										that.byId("ToDoCheckButton").setEnabled(false);
									}
								}
								that.hideBusy(true);
								that.oTable.focus();
							},
							error: function (oError) {
								that.hideBusy(true);
								that.oErrorHandler.processError(oError);
							}
						});

					}, true);
			oModel.attachBatchRequestCompleted(this.onSubmissionSuccess.bind(this));
		},
		onToDoSubmitCheck: function () {
			if (this.successfulToDoCheck === "X") {
				this.onToDoSubmit();
			} else {
				this.onCheckEntriesToDo(true);
			}
		},
		onToDoSubmit: function (oEvent) {
			var that = this;
			this.showBusy();
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
					function (oData) {
						if (submitEntries.length === 0) {
							that.hideBusy(true);
							var toastMsg = that.oBundle.getText("noEntriesToSubmit");
							sap.m.MessageToast.show(toastMsg, {
								duration: 3000
							});
							sap.ui.getCore().getMessageManager().removeAllMessages();
							that.byId("ToDoSubmitButton").setEnabled(false);
							if (that.checkButtonNeeded === "X") {
								that.byId("ToDoCheckButton").setEnabled(false);
							}
							return;
						}
						for (var i = 0; i < submitEntries.length; i++) {
							var obj = {
								properties: submitEntries[i],
								changeSetId: "TimeEntry",
								groupId: "TimeEntry"
							};
							oModel
								.createEntry(
									that.appendLocaleParameter("/TimeEntryCollection"),
									obj);
						}
						oModel.submitChanges({
							groupId: "TimeEntry",
							changeSetId: "TimeEntry",
							success: function (oData, res) {
								// that.responses = oData.__batchResponses[0].__changeResponses;
								that.byId("ToDoSubmitButton").setEnabled(false);
								if (that.oMessagePopover) {
									// that.oMessagePopover.removeAllItems();
									that.oMessagePopover.destroy();
									sap.ui.getCore().getMessageManager().removeAllMessages();
									// that.oMessagePopover.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
								}
								var error = false;
								var entries = that.getModel('TodoList').getData();
								var oMessages = [];
								if (!oData.__batchResponses[0].__changeResponses) {
									var messageText = "";
									var messageType = "";
									var errorJSON = JSON.parse(oData.__batchResponses[0].response.body);
									var totalLength = errorJSON.error.innererror.errordetails.length - 1;
									sap.ui.getCore().getMessageManager().removeAllMessages();
									// Additional coding to handle error message(s)
									for (var len = 0; len < totalLength; len++) {
										messageText = errorJSON.error.innererror.errordetails[len].message;
										messageType = errorJSON.error.innererror.errordetails[len].severity;
										if (messageType == "warning") {
											sap.ui.getCore().getMessageManager().addMessages(
												new sap.ui.core.message.Message({
													message: messageText,
													description: messageText,
													type: sap.ui.core.MessageType.Warning,
													processor: that.getOwnerComponent().oMessageProcessor,
													code: "TimeData"
												}));
										} else {
											sap.ui.getCore().getMessageManager().addMessages(
												new sap.ui.core.message.Message({
													message: messageText,
													description: messageText,
													type: sap.ui.core.MessageType.Error,
													processor: that.getOwnerComponent().oMessageProcessor,
													code: "TimeData"
												}));
											error = true;
										}
									}
									//if message type is error then add the last error message
									if (!errorJSON.error.innererror.errordetails[len].code.match("/IWBEP")) {
										messageText = errorJSON.error.innererror.errordetails[len].message;
										sap.ui.getCore().getMessageManager().addMessages(
											new sap.ui.core.message.Message({
												message: messageText,
												description: messageText,
												type: sap.ui.core.MessageType.Error,
												processor: that.getOwnerComponent().oMessageProcessor,
												code: "TimeData"
											}));
										error = true;
									}
									that.hideBusy(true);
								}
								// } else {
								// 	for (var i = 0; i < oData.__batchResponses[0].__changeResponses.length; i++) {
								// 		var entry = $.grep(entries, function (element, ind) {
								// 			if (element.RecRowNo) {
								// 				return element.RecRowNo === parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo).toString();
								// 			}
								// 		});
								// 		if (oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg !== "") {
								// 			error = true;
								// 			if (entry.length > 0) {
								// 				entry[0].valueState = "Error";
								// 				entry[0].highlight = "Error";
								// 				entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
								// 				oMessages.push(new sap.ui.core.message.Message({
								// 					message: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 					description: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 					type: sap.ui.core.MessageType.Error,
								// 					processor: that.getOwnerComponent().oMessageProcessor,
								// 					additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
								// 					code: "TodoList"
								// 				}));
								// 			}

								// 		} else {
								// 			if (entry.length > 0) {
								// 				entry[0].valueState = "Success";
								// 				entry[0].highlight = "Success";
								// 			}
								// 		}
								// 	}
								// }
								// sap.ui.getCore().getMessageManager().addMessages(
								// 	oMessages
								// );
								that.getModel('TodoList').updateBindings();
								// that.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
								var toastMsg;
								if (!error) {
									toastMsg = that.oBundle.getText("timeEntriesSaved");
								} else {
									toastMsg = that.oBundle.getText("resubmitTimeEntries");
								}
								sap.m.MessageToast.show(toastMsg, {
									duration: 1000
								});
								that.getToDoList();
								that.getTimeEntries(new Date(that.dateFrom), new Date(that.dateTo));
								sap.ui.getCore().getMessageManager().removeAllMessages();
								that.resetTodoAdHocControls();
								var data = [];
								var oModel = new JSONModel();
								oModel.setData(data);
								that.setModel(oModel, 'deleteRecords');
								that.setModel(oModel, 'changedRecords');
								that.setModel(oModel, 'newRecords');
								if (that.oReadOnlyToDoTemplate) {
									that.rebindTableWithTemplate(that.oToDoTable, "TodoList>/", that.oReadOnlyToDoTemplate, "Navigation");
								}
								oControl.setProperty("/editTodoVisibility", true);
								oControl.setProperty("/todoDone", false);
								oControl.setProperty("/todoCancel", false);
								oControl.setProperty("/todoDoneCheck", false);
								if (!sap.ui.Device.system.phone) {
									oControl.setProperty("/showFooter", false);
								}
								if (that.checkButtonNeeded === "X") {
									that.getModel("controls").setProperty("/todoDataChangedWithCheck", false);
								}
								oControl.setProperty("/todoDataChanged", false);
								oControl.setProperty("/isToDoChanged", false);
								sap.ushell.Container.setDirtyFlag(false);

								that.hideBusy(true);
							},
							error: function (oError) {
								that.hideBusy(true);
								that.oErrorHandler.processError(oError);
							}
						});

					}, true);
			oModel.attachBatchRequestCompleted(this.onSubmissionSuccess.bind(this));
		},
		onStartDateChange: function (oEvent) {
			if (this.getModel('controls').getProperty('/currentAdHoc') && !sap.ui.Device.system.phone) //In case of mobile we will restrict the flow to that single week
			{
				//Just fetch the entries from startdate and endate of two months
				// Fetching the data for two months
				//	this.calendar.setBusy(true);

				var that = this;
				var startdate, enddate, dateFrom, dateTo;
				var oCalendar = oEvent.getSource();
				var oControl = this.getModel("controls");
				var curDate = new Date();
				curDate = new Date(oCalendar.getStartDate());

				if (sap.ui.Device.system.phone === true) {
					dateFrom = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
					dateTo = this.getLastDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
					startdate = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
					enddate = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
				} else {
					dateFrom = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
					curDate.setMonth(curDate.getMonth() + 2, 0);
					dateTo = this.getLastDayOfWeek(curDate, that.firstDayOfWeek);
					if (that.dailyView === "X") {
						startdate = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
						enddate = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
					} else {

						startdate = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
						enddate = this.getLastDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
					}
				}
				dateFrom.setDate(dateFrom.getDate() - 1);
				dateTo.getDate(dateTo.getDate() + 1);
				this.getTimeEntriesOnDemand(dateFrom, new Date(dateTo), true).then(function () {
					that.calendar.setBusy(false);
				}); //true will be used to color the legends of the calendar

				return;
			}

			var that = this;
			if (!sap.ui.Device.system.phone) {
				if (that.nextEnabled === false) {
					if (that.calendar.getStartDate().getMonth() === that.calendar.getMaxDate().getMonth() &&
						that.calendar.getStartDate().getMonth() !== (new Date()).getMonth()) {
						//Fire previous month if it goes to next month
						that.calendar.getAggregation("header").firePressPrevious();

					}
				}

			}
			var oCalendar = oEvent.getSource();
			var oControl = this.getModel("controls");
			var curDate = new Date();
			curDate = new Date(oCalendar.getStartDate());
			// if (curDate > this.minDate && curDate < this.maxDate) {

			// } else {
			// 	curDate = this.minDate;
			// }
			if (sap.ui.Device.system.phone === true) {
				this.dateFrom = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
				// curDate.setDate(oCalendar.getStartDate().getDate() + 6);
				this.dateTo = this.getLastDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
				this.startdate = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
				this.enddate = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
			} else {
				this.dateFrom = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
				curDate.setMonth(curDate.getMonth() + 2, 0);
				this.dateTo = this.getLastDayOfWeek(curDate, that.firstDayOfWeek);
				if (that.dailyView === "X") {
					this.startdate = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
					this.enddate = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
				} else {
					var date1 = new Date(that.maxDate);
					var date2 = new Date(that.minDate);
					var start1 = new Date(this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek));
					var start2 = new Date(this.getLastDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek));
					date1.setHours(0, 0, 0, 0);
					date2.setHours(0, 0, 0, 0);
					start1.setHours(0, 0, 0, 0);
					start2.setHours(0, 0, 0, 0);
					if (date2.getTime() > start1.getTime()) {
						this.startdate = new Date(date2);
						this.enddate = new Date(this.getLastDayOfWeek(new Date(date2), that.firstDayOfWeek));
					} else {
						this.startdate = this.getFirstDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
						this.enddate = this.getLastDayOfWeek(oCalendar.getStartDate(), that.firstDayOfWeek);
					}

				}
			}
			//	this.showBusy();
			if (this.oReadOnlyTemplate) {
				this.rebindTableWithTemplate(this.oTable, "TimeData>/", this.oReadOnlyTemplate, "Navigation");
			}
			oControl.setProperty('/overviewCancel', false);
			oControl.setProperty('/sendForApproval', false);
			oControl.setProperty('/sendForApprovalCheck', false);
			oControl.setProperty('/submitDraft', false);
			oControl.setProperty('/todoDone', false);
			oControl.setProperty("/todoDoneCheck", false);
			oControl.setProperty('/todoCancel', false);
			oControl.setProperty('/onEdit', "None");
			oControl.setProperty('/submitDraft', false);
			oControl.setProperty('/duplicateVisibility', false);
			oControl.setProperty('/duplicateWeekVisibility', false);
			oControl.setProperty('/overviewEdit', true);
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			if (oControl.getProperty("/isOverviewChanged") === true || oControl.getProperty("/overviewDataChangedWithCheck") === true) {
				sap.m.MessageBox.warning(
					that.oBundle.getText("confirmationSwitchTabGeneral"), {
						title: that.oBundle.getText("confirm"),
						actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
						styleClass: bCompact ? "sapUiSizeCompact" : "",
						onClose: function (sAction) {
							if (sAction === "CANCEL") {

							} else {
								that.getTimeEntries(new Date(that.dateFrom), new Date(that.dateTo));
								oControl.setProperty('/isOverviewChanged', false);
								oControl.setProperty('/overviewDataChangedWithCheck', false);
							}
						}
					}
				);
			} else {
				that.getTimeEntries(new Date(that.dateFrom), new Date(that.dateTo));
			}
			that.resetAdHocControls(); //In case of mobile with adhoc
			// that.bindTable(new Date(this.startdate), new Date(this.enddate));

		},
		onCheckEntries: function (submitTrue) {
			var that = this;
			this.showBusy();
			var submitEntries = this.fetchRecords(true, "X");
			for (var c = 0; c < submitEntries.length; c++) {
				if ((submitEntries[c].TimeEntryDataFields.CATSHOURS == 0) && (submitEntries[c].TimeEntryDataFields.CATSAMOUNT == 0) && (
						submitEntries[c].TimeEntryDataFields.CATSQUANTITY == 0)) {
					//If it is a zero hour/amount/quantity
					if ((submitEntries[c].TimeEntryDataFields.BEGUZ == 0) && (submitEntries[c].TimeEntryDataFields.ENDUZ == 0)) {
						submitEntries.splice(c, 1);
						//If start time and end time are also not specified then do not consider record for submit
						c--;
					}
				}
			}
			var oTimeData = this.getModel('TimeData').getData();
			for (var i = 0; i < oTimeData.length; i++) {
				oTimeData[i].valueState = "None";
				oTimeData[i].highlight = "None";
			}
			var selectedItems;
			var data;
			var oModel = $.extend(true, {}, this.oDataModel);
			var oControl = this.getModel("controls");
			this.batches = submitEntries;
			var mParameters;
			oModel.setChangeBatchGroups({
				"*": {
					groupId: "TimeEntry",
					changeSetId: "TimeEntry",
					single: true
				}
			});
			oModel.setDeferredGroups(["TimeEntry"]);
			oModel
				.refreshSecurityToken(
					function (oData) {
						if (submitEntries.length === 0) {
							that.hideBusy(true);
							var toastMsg = that.oBundle.getText("noEntriesToSubmit");
							sap.m.MessageToast.show(toastMsg, {
								duration: 3000
							});
							sap.ui.getCore().getMessageManager().removeAllMessages();
							that.byId("OverviewSubmitButton").setEnabled(false);
							if (that.checkButtonNeeded === "X") {
								that.byId("OverviewCheckButton").setEnabled(false);
							}
							return;
						}
						for (var i = 0; i < submitEntries.length; i++) {
							var obj = {
								properties: submitEntries[i],
								changeSetId: "TimeEntry",
								groupId: "TimeEntry"
							};
							oModel
								.createEntry(
									that.appendLocaleParameter("/TimeEntryCollection"),
									obj);
						}

						oModel.submitChanges({
							groupId: "TimeEntry",
							changeSetId: "TimeEntry",
							success: function (oData, res) {
								// that.responses = oData.__batchResponses[0].__changeResponses;
								if (that.oMessagePopover) {
									// that.oMessagePopover.removeAllItems();
									that.oMessagePopover.destroy();
									sap.ui.getCore().getMessageManager().removeAllMessages();
									// that.oMessagePopover.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
								}
								var error = false;
								var warning = false;
								var errorVeto = false;
								var warningVeto = false;
								var errorJSON;
								var mText = "";
								var mTextAll = "";
								var entries = that.getModel('TimeData').getData();
								var oMessages = [];
								if (!oData.__batchResponses[0].__changeResponses) {
									var messageText = "";
									var messageType = "";
									var messageClass = "";
									var messageNumber = "";
									var errorJSON = JSON.parse(oData.__batchResponses[0].response.body);
									var totalLength = errorJSON.error.innererror.errordetails.length - 1;
									sap.ui.getCore().getMessageManager().removeAllMessages();
									// Additional coding to handle error message(s)
									for (var len = 0; len < totalLength; len++) {
										messageText = errorJSON.error.innererror.errordetails[len].message;
										messageType = errorJSON.error.innererror.errordetails[len].severity;
										if (messageType == "warning") {
											sap.ui.getCore().getMessageManager().addMessages(
												new sap.ui.core.message.Message({
													message: messageText,
													description: messageText,
													type: sap.ui.core.MessageType.Warning,
													processor: that.getOwnerComponent().oMessageProcessor,
													code: "TimeData"
												}));
										} else {
											sap.ui.getCore().getMessageManager().addMessages(
												new sap.ui.core.message.Message({
													message: messageText,
													description: messageText,
													type: sap.ui.core.MessageType.Error,
													processor: that.getOwnerComponent().oMessageProcessor,
													code: "TimeData"
												}));
											error = true;
										}
									}
									//if message type is error then add the last error message
									if (!errorJSON.error.innererror.errordetails[len].code.match("/IWBEP")) {
										messageText = errorJSON.error.innererror.errordetails[len].message;
										sap.ui.getCore().getMessageManager().addMessages(
											new sap.ui.core.message.Message({
												message: messageText,
												description: messageText,
												type: sap.ui.core.MessageType.Error,
												processor: that.getOwnerComponent().oMessageProcessor,
												code: "TimeData"
											}));
										error = true;
									}
									that.hideBusy(true);
									//	return;
								} else {
									for (var i = 0; i < oData.__batchResponses[0].__changeResponses.length; i++) {
										var entry = $.grep(entries, function (element, ind) {
											if (element.RecRowNo) {
												return element.RecRowNo === parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo).toString();
											}
										});
										//
										if (entry.length > 0) {
											var counter = entry[0].Counter;
											if (counter && counter !== null) {
												entry[0].TimeEntryOperation = 'U';
											} else {
												entry[0].TimeEntryOperation = 'C';
											}

											entry[0].TimeEntryDataFields.CATSHOURS = parseFloat(oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields
												.CATSHOURS).toFixed(2);
											if (entry[0].TimeEntryDataFields.CATSHOURS === "0.00" && entry[0].TimeEntryDataFields.CATSQUANTITY !== "") {
												entry[0].TimeEntryDataFields.CATSHOURS = parseFloat(oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields
													.CATSQUANTITY).toFixed(2);
											}
											entry[0].TimeEntryDataFields.CATSQUANTITY = parseFloat(oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields
												.CATSQUANTITY).toFixed(3);
											entry[0].TimeEntryDataFields.BEGUZ = oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields.BEGUZ;
											entry[0].TimeEntryDataFields.ENDUZ = oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields.ENDUZ;
											//Changin header data Reading entries for that day

											that.calculateSum(new Date(oData.__batchResponses[0].__changeResponses[i].data.TimeEntryDataFields.WORKDATE),
												that.getModel('TimeData').getData());

											that.setFocusFixedElement();
											if (that.oEditableTemplate) {
												that.rebindTableWithTemplate(that.oTable, "TimeData>/", that.oEditableTemplate, "Edit");
											}
											that.getEnteredHours(true);

										}
										// that.setModel(new JSONModel(entry), 'TimeData');
										//
										error = warning = false;
										if (oData.__batchResponses[0].__changeResponses[i].data.Message1 !== "" || oData.__batchResponses[0].__changeResponses[
												i]
											.data.CustomMessage !== "" || oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg !== "") {
											var messageClass = oData.__batchResponses[0].__changeResponses[i].data.MessageClass1;
											var messageNumber = oData.__batchResponses[0].__changeResponses[i].data.MessageNumber1;

											var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
												style: 'long'
											});
											if (messageClass === 'LR' && messageNumber === "201") {
												oData.__batchResponses[0].__changeResponses[i].data.Message1 = oDateFormat
													.format(new Date(entry[0].HeaderData.date)) + ": " + that.oBundle.getText("collisionMessage");
											} else if (messageClass === 'LR' && messageNumber === "206") {
												oData.__batchResponses[0].__changeResponses[i].data.Message1 = oDateFormat
													.format(new Date(entry[0].HeaderData.date)) + ": " + that.oBundle.getText("extraHoursMessage");
											} else if (messageClass === 'LR' && messageNumber === "205") {
												oData.__batchResponses[0].__changeResponses[i].data.Message1 = oDateFormat
													.format(new Date(entry[0].HeaderData.date)) + ": " + that.oBundle.getText("lessHoursMessage");
											} else {
												oData.__batchResponses[0].__changeResponses[i].data.Message1 = oDateFormat
													.format(new Date(entry[0].HeaderData.date)) + ": " + oData.__batchResponses[0].__changeResponses[i].data.Message1;
											}

											switch (oData.__batchResponses[0].__changeResponses[i].data.Message1Type) {

											case "E":
												errorVeto = true;
												if (entry.length > 0) {
													//	entry[0].valueState = "Error";
													entry[0].highlight = "Error";
													entry[0].HeaderData.highlight = false;

													//	entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message1;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														description: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														type: sap.ui.core.MessageType.Error,
														processor: that.getOwnerComponent().oMessageProcessor,
														additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
														code: "TimeData"
													}));
												}
												break;
											case "W":
												warning = true;
												warningVeto = true;
												if (entry.length > 0) {
													//	entry[0].valueState = "Warning";
													entry[0].highlight = "Warning";
													entry[0].HeaderData.highlight = false;

													//	entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message1;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														description: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														type: sap.ui.core.MessageType.Warning,
														processor: that.getOwnerComponent().oMessageProcessor,
														additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
														code: "TimeData"
													}));
												}
												break;
											case "I":
												if (entry.length > 0) {
													//	entry[0].valueState = "Information";
													entry[0].highlight = "Information";
													entry[0].HeaderData.highlight = false;
													//	entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message1;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														description: oData.__batchResponses[0].__changeResponses[i].data.Message1,
														type: sap.ui.core.MessageType.Information,
														processor: that.getOwnerComponent().oMessageProcessor,
														additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
														code: "TimeData"
													}));
												}
												break;
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.Message2 !== "") {
												var messageClass = oData.__batchResponses[0].__changeResponses[i].data.MessageClass2;
												var messageNumber = oData.__batchResponses[0].__changeResponses[i].data.MessageNumber2;

												var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
													style: 'long'
												});
												if (messageClass === 'LR' && messageNumber === "201") {
													oData.__batchResponses[0].__changeResponses[i].data.Message2 = oDateFormat
														.format(new Date(entry[0].HeaderData.date)) + ": " + that.oBundle.getText("collisionMessage");
												} else if (messageClass === 'LR' && messageNumber === "206") {
													oData.__batchResponses[0].__changeResponses[i].data.Message2 = oDateFormat
														.format(new Date(entry[0].HeaderData.date)) + ": " + that.oBundle.getText("extraHoursMessage");
												} else if (messageClass === 'LR' && messageNumber === "205") {
													oData.__batchResponses[0].__changeResponses[i].data.Message2 = oDateFormat
														.format(new Date(entry[0].HeaderData.date)) + ": " + that.oBundle.getText("lessHoursMessage");
												} else {
													oData.__batchResponses[0].__changeResponses[i].data.Message2 = oDateFormat
														.format(new Date(entry[0].HeaderData.date)) + ": " + oData.__batchResponses[0].__changeResponses[i].data.Message2;
												}

												switch (oData.__batchResponses[0].__changeResponses[i].data.Message2Type) {
												case "E":
													errorVeto = true;
													if (entry.length > 0) {
														if (entry[0].valueState != "Error") {
															//	entry[0].valueState = "Error";
															entry[0].highlight = "Error";
															entry[0].HeaderData.highlight = false;
															//	entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message2;
														}
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															type: sap.ui.core.MessageType.Error,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TimeData"
														}));
													}
													break;
												case "W":
													warning = true;
													warningVeto = true;
													if (entry.length > 0) {
														if (entry[0].valueState != "Error" && entry[0].valueState != "Warning") {
															//	entry[0].valueState = "Warning";
															entry[0].highlight = "Warning";
															entry[0].HeaderData.highlight = false;
															//	entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message2;
														}
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															type: sap.ui.core.MessageType.Warning,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TimeData"
														}));
													}
													break;
												case "I":
													if (entry.length > 0) {
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message2,
															type: sap.ui.core.MessageType.Information,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TimeData"
														}));
													}
													break;
												}
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.Message3 !== "") {
												var messageClass = oData.__batchResponses[0].__changeResponses[i].data.MessageClass3;
												var messageNumber = oData.__batchResponses[0].__changeResponses[i].data.MessageNumber3;

												var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
													style: 'long'
												});
												if (messageClass === 'LR' && messageNumber === "201") {
													oData.__batchResponses[0].__changeResponses[i].data.Message3 = oDateFormat
														.format(new Date(entry[0].HeaderData.date)) + ": " + that.oBundle.getText("collisionMessage");
												} else if (messageClass === 'LR' && messageNumber === "206") {
													oData.__batchResponses[0].__changeResponses[i].data.Message3 = oDateFormat
														.format(new Date(entry[0].HeaderData.date)) + ": " + that.oBundle.getText("extraHoursMessage");
												} else if (messageClass === 'LR' && messageNumber === "205") {
													oData.__batchResponses[0].__changeResponses[i].data.Message3 = oDateFormat
														.format(new Date(entry[0].HeaderData.date)) + ": " + that.oBundle.getText("lessHoursMessage");
												} else {
													oData.__batchResponses[0].__changeResponses[i].data.Message3 = oDateFormat
														.format(new Date(entry[0].HeaderData.date)) + ": " + oData.__batchResponses[0].__changeResponses[i].data.Message3;
												}

												switch (oData.__batchResponses[0].__changeResponses[i].data.Message3Type) {
												case "E":

													errorVeto = true;
													if (entry.length > 0) {
														if (entry[0].valueState != "Error") {
															//entry[0].valueState = "Error";
															entry[0].highlight = "Error";
															entry[0].HeaderData.highlight = false;

															//entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message3;
														}
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															type: sap.ui.core.MessageType.Error,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TimeData"
														}));
													}
													break;
												case "W":
													warning = true;
													warningVeto = true;
													if (entry.length > 0) {
														if (entry[0].valueState != "Error" && entry[0].valueState != "Warning") {
															//	entry[0].valueState = "Warning";
															entry[0].highlight = "Warning";
															entry[0].HeaderData.highlight = false;

															//	entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.Message3;
														}
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															type: sap.ui.core.MessageType.Warning,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TimeData"
														}));
													}
													break;
												case "I":
													if (entry.length > 0) {
														oMessages.push(new sap.ui.core.message.Message({
															message: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															description: oData.__batchResponses[0].__changeResponses[i].data.Message3,
															type: sap.ui.core.MessageType.Information,
															processor: that.getOwnerComponent().oMessageProcessor,
															additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
															code: "TimeData"
														}));
													}
													break;
												}
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg !== "") {
												var messageClass = oData.__batchResponses[0].__changeResponses[i].data.ErrorMessageClass;
												var messageNumber = oData.__batchResponses[0].__changeResponses[i].data.ErrorMessgeNumber;
												//In case of unmapped error it may be filled but not mapped to date or entry
												var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
													style: 'long'
												});
												if (messageClass === 'LR' && messageNumber === "201") {
													oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg = that.oBundle.getText("collisionMessage");
												} else if (messageClass === 'LR' && messageNumber === "206") {
													oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg = that.oBundle.getText("extraHoursMessage");
												} else if (messageClass === 'LR' && messageNumber === "205") {
													oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg = that.oBundle.getText("lessHoursMessage");
												} else {
													oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
												}

												errorVeto = true;
												oMessages.push(new sap.ui.core.message.Message({
													message: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
													description: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
													type: sap.ui.core.MessageType.Error,
													processor: that.getOwnerComponent().oMessageProcessor,
													code: "TimeData"
												}));
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.CustomMessage !== "") {
												switch (oData.__batchResponses[0].__changeResponses[i].data.CustomMessageType) {
												case "E":
													errorVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														type: sap.ui.core.MessageType.Error,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TimeData"
													}));
													break;
												case "W":
													warning = true;
													warningVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														type: sap.ui.core.MessageType.Warning,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TimeData"
													}));
													break;
												case "I":
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage,
														type: sap.ui.core.MessageType.Information,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TimeData"
													}));
													break;
												}
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1 !== "") {
												switch (oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1Type) {
												case "E":
													errorVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														type: sap.ui.core.MessageType.Error,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TimeData"
													}));
													break;
												case "W":
													warning = true;
													warningVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														type: sap.ui.core.MessageType.Warning,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TimeData"
													}));
													break;
												case "I":
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage1,
														type: sap.ui.core.MessageType.Information,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TimeData"
													}));
													break;
												}
											}
											if (oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2 !== "") {
												switch (oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2Type) {
												case "E":
													errorVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														type: sap.ui.core.MessageType.Error,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TimeData"
													}));
													break;
												case "W":
													warning = true;
													warningVeto = true;
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														type: sap.ui.core.MessageType.Warning,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TimeData"
													}));
													break;
												case "I":
													oMessages.push(new sap.ui.core.message.Message({
														message: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														description: oData.__batchResponses[0].__changeResponses[i].data.CustomMessage2,
														type: sap.ui.core.MessageType.Information,
														processor: that.getOwnerComponent().oMessageProcessor,
														code: "TimeData"
													}));
													break;
												}
											}
										}
									}
								}
								// } else if (oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg !== "") {
								// 	errorJSON = JSON.parse(oData.__batchResponses[0].__changeResponses[0].headers["sap-message"]);
								// 	if (errorJSON.severity === "error") {
								// 		error = true;
								// 		errorVeto = true;
								// 	} else if (errorJSON.severity === "warning") {
								// 		warning = true;
								// 		warningVeto = true;
								// 	}
								// 	if (entry.length > 0) {
								// 		if (error === true) {
								// 			entry[0].valueState = "Error";
								// 			entry[0].highlight = "Error";
								// 			entry[0].HeaderData.highlight = false;

								// 			entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
								// 			mText = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
								// 			oMessages.push(new sap.ui.core.message.Message({
								// 				message: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 				description: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 				type: sap.ui.core.MessageType.Error,
								// 				processor: that.getOwnerComponent().oMessageProcessor,
								// 				additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
								// 				code: "TimeData"
								// 			}));
								// 		} else if (warning === true) {
								// 			entry[0].valueState = "Warning";
								// 			entry[0].highlight = "Warning";
								// 			entry[0].HeaderData.highlight = false;

								// 			entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
								// 			mText = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
								// 			oMessages.push(new sap.ui.core.message.Message({
								// 				message: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 				description: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 				type: sap.ui.core.MessageType.Warning,
								// 				processor: that.getOwnerComponent().oMessageProcessor,
								// 				additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
								// 				code: "TimeData"
								// 			}));
								// 		}
								// 	}
								// 	// error = true;
								// 	mTextAll = mTextAll + "\n" + mText;
								// } else {
								// 	if (entry.length > 0) {
								// 		entry[0].valueState = "Success";
								// 		entry[0].highlight = "Success";
								// 	}
								// }
								// mTextAll = mTextAll + "\n" + mText;
								// }
								// mTextAll = mTextAll + "\n" + mText;
								// }
								sap.ui.getCore().getMessageManager().removeAllMessages();
								sap.ui.getCore().getMessageManager().addMessages(
									oMessages
								);
								// that.getModel('TimeData').updateBindings();
								// that.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
								var toastMsg;
								var messageTitle;
								var messageTitleText;
								if (errorVeto === false && warningVeto === false) {
									that.successfulCheck = "X";
									if (submitTrue === true) {
										that.onSendApproval();
									} else {
										that.getModel('TimeData').updateBindings();
										toastMsg = that.oBundle.getText("noErrors");
										that.byId("OverviewSubmitButton").setEnabled(true);
										if (that.checkButtonNeeded === "X") {
											that.byId("OverviewCheckButton").setEnabled(false);
										}
										sap.m.MessageToast.show(toastMsg, {
											duration: 3000
										});
										that.getModel('TimeData').updateBindings();
									}
								} else if (errorVeto === false && warningVeto === true) {
									that.successfulCheck = "X";
									// if (submitTrue === true) {
									// 	that.onSendApproval();
									// } else {
									messageTitle = that.oBundle.getText("warnings");
									messageTitleText = that.oBundle.getText("checkResultedWarnings");
									sap.m.MessageBox.warning(messageTitleText, {
										title: messageTitle,
										styleClass: "sapUiResponsivePadding--header sapUiResponsivePadding--content sapUiResponsivePadding--footer",
										onClose: that.getModel('TimeData').updateBindings()
									});
									that.byId("OverviewSubmitButton").setEnabled(true);
									if (that.checkButtonNeeded === "X") {
										that.byId("OverviewCheckButton").setEnabled(false);
									}
									// }
								} else {
									messageTitle = that.oBundle.getText("errors");
									messageTitleText = that.oBundle.getText("checkResultedErrors");
									sap.m.MessageBox.error(messageTitleText, {
										title: messageTitle,
										styleClass: "sapUiResponsivePadding--header sapUiResponsivePadding--content sapUiResponsivePadding--footer",
										onClose: that.getModel('TimeData').updateBindings()
									});
									that.byId("OverviewSubmitButton").setEnabled(false);
									if (that.checkButtonNeeded === "X") {
										that.byId("OverviewCheckButton").setEnabled(false);
									}
								}
								that.hideBusy(true);
								that.oTable.getModel('TimeData').refresh();
								that.oTable.focus();
							},
							error: function (oError) {
								that.hideBusy(true);
								that.oErrorHandler.processError(oError);
							}
						});

					}, true);
			oModel.attachBatchRequestCompleted(this.onSubmissionSuccess.bind(this));
			oModel.attachBatchRequestFailed(function () {
				that.handleMessagePopover(new sap.m.Button());
			});

		},
		onSendApprovalCheck: function () {
			if (this.successfulCheck === "X") {
				this.onSendApproval();
			} else {
				this.onCheckEntries(true);
			}
		},
		onSendApproval: function () {
			var that = this;
			this.showBusy();
			var submitEntries = this.fetchRecords(true);
			for (var c = 0; c < submitEntries.length; c++) {
				if ((submitEntries[c].TimeEntryDataFields.CATSHOURS == 0) && (submitEntries[c].TimeEntryDataFields.CATSAMOUNT == 0) && (
						submitEntries[c].TimeEntryDataFields.CATSQUANTITY == 0)) {
					//If it is a zero hour/amount/quantity
					if ((submitEntries[c].TimeEntryDataFields.BEGUZ == 0) && (submitEntries[c].TimeEntryDataFields.ENDUZ == 0)) {
						submitEntries.splice(c, 1);
						//If start time and end time are also not specified then do not consider record for submit
						c--;
					}
				}
			}
			var selectedItems;
			var data;
			var oModel = $.extend(true, {}, this.oDataModel);
			var oControl = this.getModel("controls");
			this.batches = submitEntries;
			var mParameters;
			oModel.setChangeBatchGroups({
				"*": {
					groupId: "TimeEntry",
					changeSetId: "TimeEntry",
					single: true
				}
			});
			oModel.setDeferredGroups(["TimeEntry"]);
			oModel
				.refreshSecurityToken(
					function (oData) {
						if (submitEntries.length === 0) {
							that.hideBusy(true);
							var toastMsg = that.oBundle.getText("noEntriesToSubmit");
							sap.m.MessageToast.show(toastMsg, {
								duration: 3000
							});
							sap.ui.getCore().getMessageManager().removeAllMessages();
							that.byId("OverviewSubmitButton").setEnabled(false);
							if (that.checkButtonNeeded === "X") {
								that.byId("OverviewCheckButton").setEnabled(false);
							}
							return;
						}
						for (var i = 0; i < submitEntries.length; i++) {
							var obj = {
								properties: submitEntries[i],
								changeSetId: "TimeEntry",
								groupId: "TimeEntry"
							};
							oModel.createEntry(
								that.appendLocaleParameter("/TimeEntryCollection"),
								obj);
						}

						oModel.submitChanges({
							groupId: "TimeEntry",
							changeSetId: "TimeEntry",
							success: function (oData, res) {
								// that.responses = oData.__batchResponses[0].__changeResponses;
								that.byId("OverviewSubmitButton").setEnabled(false);
								if (that.oMessagePopover) {
									// that.oMessagePopover.removeAllItems();
									that.oMessagePopover.destroy();
									sap.ui.getCore().getMessageManager().removeAllMessages();
									// that.oMessagePopover.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
								}
								var error = false;
								var entries = that.getModel('TimeData').getData();
								var oMessages = [];
								if (!oData.__batchResponses[0].__changeResponses) {
									var messageText = "";
									var messageType = "";
									var errorJSON = JSON.parse(oData.__batchResponses[0].response.body);
									var totalLength = errorJSON.error.innererror.errordetails.length - 1;
									sap.ui.getCore().getMessageManager().removeAllMessages();
									// Additional coding to handle error message(s)
									for (var len = 0; len < totalLength; len++) {
										messageText = errorJSON.error.innererror.errordetails[len].message;
										messageType = errorJSON.error.innererror.errordetails[len].severity;
										if (messageType == "warning") {
											sap.ui.getCore().getMessageManager().addMessages(
												new sap.ui.core.message.Message({
													message: messageText,
													description: messageText,
													type: sap.ui.core.MessageType.Warning,
													processor: that.getOwnerComponent().oMessageProcessor,
													code: "TimeData"
												}));
										} else {
											sap.ui.getCore().getMessageManager().addMessages(
												new sap.ui.core.message.Message({
													message: messageText,
													description: messageText,
													type: sap.ui.core.MessageType.Error,
													processor: that.getOwnerComponent().oMessageProcessor,
													code: "TimeData"
												}));
											error = true;
										}
									}
									//if message type is error then add the last error message
									if (!errorJSON.error.innererror.errordetails[len].code.match("/IWBEP")) {
										messageText = errorJSON.error.innererror.errordetails[len].message;
										sap.ui.getCore().getMessageManager().addMessages(
											new sap.ui.core.message.Message({
												message: messageText,
												description: messageText,
												type: sap.ui.core.MessageType.Error,
												processor: that.getOwnerComponent().oMessageProcessor,
												code: "TimeData"
											}));
										error = true;
									}
									that.hideBusy(true);
									//	return;
								}
								// } else {
								// 	for (var i = 0; i < oData.__batchResponses[0].__changeResponses.length; i++) {
								// 		var entry = $.grep(entries, function (element, ind) {
								// 			if (element.RecRowNo) {
								// 				return element.RecRowNo === parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo).toString();
								// 			}
								// 		});
								// 		if (oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg !== "") {
								// 			error = true;
								// 			if (entry.length > 0) {
								// 				entry[0].valueState = "Error";
								// 				entry[0].highlight = "Error";
								// 				entry[0].valueStateText = oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg;
								// 				oMessages.push(new sap.ui.core.message.Message({
								// 					message: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 					description: oData.__batchResponses[0].__changeResponses[i].data.ErrorMsg,
								// 					type: sap.ui.core.MessageType.Error,
								// 					processor: that.getOwnerComponent().oMessageProcessor,
								// 					additionalText: parseInt(oData.__batchResponses[0].__changeResponses[i].data.RecRowNo),
								// 					code: "TimeData"
								// 				}));
								// 			}
								// 			error = true;

								// 		} else {
								// 			if (entry.length > 0) {
								// 				entry[0].valueState = "Success";
								// 				entry[0].highlight = "Success";
								// 			}
								// 		}
								// 	}
								// }
								// sap.ui.getCore().getMessageManager().addMessages(
								// 	oMessages
								// );

								// that.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
								var toastMsg;
								if (!error) {
									toastMsg = that.oBundle.getText("timeEntriesSaved");
								} else {
									toastMsg = that.oBundle.getText("resubmitTimeEntries");
								}
								sap.m.MessageToast.show(toastMsg, {
									duration: 1000
								});
								oControl.setProperty("/intervalSelection", true);
								oControl.setProperty("/singleSelection", true);
								oControl.setProperty("/currentAdHoc", false);
								that.adHocSelectedDates = null;
								var oData = [];
								that.setModel(new JSONModel(oData), "adHocCreateCopy");
								that.getTimeEntries(new Date(that.minDate), new Date(that.maxDate));
								that.getToDoList();
								sap.ui.getCore().getMessageManager().removeAllMessages();
								var data = [];
								var oModel = new JSONModel();
								oModel.setData(data);
								that.setModel(oModel, 'deleteRecords');
								that.setModel(oModel, 'changedRecords');
								that.setModel(oModel, 'newRecords');
								if (that.oReadOnlyTemplate) {
									that.rebindTableWithTemplate(that.oTable, "TimeData>/", that.oReadOnlyTemplate, "Navigation");
									that.getEnteredHours(false);
								}
								oControl.setProperty("/overviewEdit", true);
								oControl.setProperty("/overviewCancel", false);
								// oControl.setProperty("/submitDraft", false);
								oControl.setProperty("/duplicateScreen", false);
								oControl.setProperty("/sendForApproval", false);
								oControl.setProperty("/sendForApprovalCheck", false);
								oControl.setProperty("/duplicateVisibility", false);
								if (!sap.ui.Device.system.phone) {
									oControl.setProperty("/showFooter", false);
								}
								oControl.setProperty("/duplicateWeekVisibility", false);
								oControl.setProperty("/onEdit", "None");
								if (that.checkButtonNeeded === "X") {
									oControl.setProperty('/overviewDataChangedWithCheck', false);
								}
								oControl.setProperty('/overviewDataChanged', false);
								oControl.setProperty('/isOverviewChanged', false);
								sap.ushell.Container.setDirtyFlag(false);
								that.setModel(oControl, "controls");
								that.calculateChangeCount();
								that.getEnteredHours(false);
								that.hideBusy(true);
								that.oTable.focus();
							},
							error: function (oError) {
								that.hideBusy(true);
								that.oErrorHandler.processError(oError);
							}
						});

					}, true);
			oModel.attachBatchRequestCompleted(this.onSubmissionSuccess.bind(this));
			oModel.attachBatchRequestFailed(function () {
				that.handleMessagePopover(new sap.m.Button());
			});

		},
		onSubmitDraft: function () {
			var that = this;
			var submitEntries = this.fetchRecords(false);
			var selectedItems;
			var oModel = $.extend(true, {}, this.oDataModel);
			var oControl = this.getModel("controls");
			this.batches = submitEntries;
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
					function (oData) {
						for (var i = 0; i < submitEntries.length; i++) {
							var obj = {
								properties: submitEntries[i],
								changeSetId: "TimeEntry",
								groupId: "TimeEntry"
							};
							oModel.createEntry(
								that.appendLocaleParameter("/TimeEntryCollection"),
								obj);
						}
						oModel.submitChanges({
							groupId: "TimeEntry",
							changeSetId: "TimeEntry",
							success: function (oData, res) {
								if (!oData.__batchResponses[0].__changeResponses) {
									// for (var i=0; i<that.batches.length;i++){
									// 	that.batches[i].TimeEntryDataFields.WORKDATE = new Date(that.batches[i].TimeEntryDataFields.WORKDATE);
									// }
									return;
								}
								var toastMsg = that.oBundle.getText("timeEntriesSaved");
								sap.m.MessageToast.show(toastMsg, {
									duration: 1000
								});
								that.getTimeEntries(new Date(that.dateFrom), new Date(that.dateTo));
								sap.ui.getCore().getMessageManager().removeAllMessages();
								var data = [];
								var oModel = new JSONModel();
								oModel.setData(data);
								that.setModel(oModel, 'deleteRecords');
								that.setModel(oModel, 'changedRecords');
								that.setModel(oModel, 'newRecords');
								if (that.oReadOnlyTemplate) {
									that.rebindTableWithTemplate(that.oTable, "TimeData>/", that.oReadOnlyTemplate, "Navigation");
									that.getEnteredHours(false);
								}
								oControl.setProperty("/overviewEdit", true);
								oControl.setProperty("/overviewCancel", false);
								oControl.setProperty("/submitDraft", false);
								if (!sap.ui.Device.system.phone) {
									oControl.setProperty("/showFooter", false);
								}
								oControl.setProperty("/sendForApproval", false);
								oControl.setProperty("/sendForApprovalCheck", false);
								oControl.setProperty("/duplicateVisibility", false);
								oControl.setProperty("/duplicateWeekVisibility", false);
								oControl.setProperty("/onEdit", "None");
								that.setModel(oControl, "controls");
							},
							error: function (oError) {
								that.oErrorHandler.processError(oError);
							}
						});

					}, true);
			oModel.attachBatchRequestCompleted(this.onSubmissionSuccess.bind(this));
		},

		onSubmissionSuccess: function () {
			// this.getTimeEntries(new Date(this.dateFrom), new Date(this.dateTo));
		},

		fetchRecords: function (oRelease, checkOnly) {
			var timeEntries = [];
			var deleteRecords = this.getModel('deleteRecords').getData();
			// var entries = $.extend(true, [], this.getModel('TimeData').getData());
			var entries = this.getModel('TimeData').getData();
			//Removing row indices
			for (var j = 0; j < entries.length; j++) {
				if (entries[j].RecRowNo) {
					entries[j].RecRowNo = "";
				}
			}
			var newRecords = $.grep(entries, function (element, index) {
				return element.TimeEntryOperation == 'C' && (element.TimeEntryDataFields.CATSHOURS != 0 || element.TimeEntryDataFields.BEGUZ !=
					0 || element.TimeEntryDataFields.ENDUZ != 0);
			});
			var changedRecords = $.grep(entries, function (element, index) {
				return element.TimeEntryOperation == 'U' && (element.TimeEntryDataFields.CATSHOURS != 0 || element.TimeEntryDataFields.BEGUZ !=
					0 || element.TimeEntryDataFields.ENDUZ != 0);
			});
			var selectedRecords = $.grep(entries, function (element, index) {
				return element.TimeEntryOperation == 'R';
			});

			for (var i = 0; i < changedRecords.length; i++) {
				changedRecords[i].TimeEntryOperation = 'U';
				if (changedRecords[i].SetDraft) {
					changedRecords[i].AllowRelease = '';
					// delete changedRecords[i].SetDraft;
				} else {
					changedRecords[i].AllowRelease = 'X';
					// delete changedRecords[i].SetDraft;
				}
			}
			for (var i = 0; i < newRecords.length; i++) {
				newRecords[i].TimeEntryOperation = 'C';
				if (newRecords[i].SetDraft) {
					newRecords[i].AllowRelease = '';
					// delete newRecords[i].SetDraft;
				} else {
					newRecords[i].AllowRelease = 'X';
					// delete newRecords[i].SetDraft;
				}
			}
			for (var i = 0; i < deleteRecords.length; i++) {

				deleteRecords[i].TimeEntryOperation = 'D';

				if (deleteRecords[i].SetDraft) {
					deleteRecords[i].AllowRelease = '';
					// delete deleteRecords[i].SetDraft;
				} else {
					deleteRecords[i].AllowRelease = 'X';
					// delete deleteRecords[i].SetDraft;
				}
			}
			if (deleteRecords.length > 0) {
				for (var i = 0; i < deleteRecords.length; i++) {
					timeEntries.push(deleteRecords[i]);
				}

			}
			if (changedRecords.length > 0) {
				for (var i = 0; i < changedRecords.length; i++) {
					timeEntries.push(changedRecords[i]);
				}
			}
			if (newRecords.length > 0) {
				for (var i = 0; i < newRecords.length; i++) {
					timeEntries.push(newRecords[i]);
				}
			}
			// }
			for (var i = 0; i < timeEntries.length; i++) {
				if (checkOnly === "X") {
					timeEntries[i].CheckOnly = "X";
				} else {
					timeEntries[i].CheckOnly = "";
				}
				timeEntries[i].RecRowNo = (i + 1).toString();
				if (timeEntries[i].TimeEntryDataFields.CATSHOURS === "") {
					timeEntries[i].TimeEntryDataFields.CATSHOURS = "0.00";
				}
			}
			var copiedEntries = $.extend(true, [], timeEntries);
			for (var i = 0; i < copiedEntries.length; i++) {
				delete copiedEntries[i].target;
				delete copiedEntries[i].totalHours;
				delete copiedEntries[i].addButton;
				delete copiedEntries[i].addButtonEnable;
				delete copiedEntries[i].deleteButtonEnable;
				delete copiedEntries[i].deleteButton;
				delete copiedEntries[i].TimeEntryDataFields.ERSDA;
				delete copiedEntries[i].TimeEntryDataFields.LAEDA;
				delete copiedEntries[i].TimeEntryDataFields.LAETM;
				delete copiedEntries[i].TimeEntryDataFields.ERSTM;
				delete copiedEntries[i].TimeEntryDataFields.APDAT;
				delete copiedEntries[i].HeaderData;
				delete copiedEntries[i].highlight;
				delete copiedEntries[i].SetDraft;
				delete copiedEntries[i].valueStateText;
				delete copiedEntries[i].valueState;
				copiedEntries[i].TimeEntryDataFields.WORKDATE = this.formatter.formatToBackendString(copiedEntries[i].TimeEntryDataFields.WORKDATE) +
					"T00:00:00";
				copiedEntries[i].TimeEntryDataFields.CATSHOURS = parseFloat(copiedEntries[i].TimeEntryDataFields.CATSHOURS).toFixed(2);
			}
			/**
			 * @ControllerHook Modify the post object
			 * This hook method can be used to modify the object before the post call
			 * It is called when the decision options for the detail item are fetched successfully
			 * @callback hcm.mytimesheet.view.S3~extHookChangeObjectBeforeSubmit
			 * @param {object} Post Object
			 * @return {object} Final Post Object
			 */

			if (this.extHookChangeObjectBeforeSubmit) {
				copiedEntries = this.extHookChangeObjectBeforeSubmit(copiedEntries);
			}
			return copiedEntries;
		},
		fetchToDoRecords: function (checkOnly) {
			var timeEntries = [];
			// var deleteRecords = this.getModel('deleteRecords').getData();
			var entries = this.getModel('TodoList').getData();
			//Removing row indices
			for (var j = 0; j < entries.length; j++) {
				if (entries[j].RecRowNo) {
					entries[j].RecRowNo = "";
				}
			}
			var newRecords = $.grep(entries, function (element, index) {
				return element.TimeEntryOperation == 'C' && (element.TimeEntryDataFields.CATSHOURS != 0 || element.TimeEntryDataFields.BEGUZ !=
					0 || element.TimeEntryDataFields.ENDUZ != 0);
			});
			var changedRecords = $.grep(entries, function (element, index) {
				return element.TimeEntryOperation == 'U' && (element.TimeEntryDataFields.CATSHOURS != 0 || element.TimeEntryDataFields.BEGUZ !=
					0 || element.TimeEntryDataFields.ENDUZ != 0);
			});
			for (var i = 0; i < changedRecords.length; i++) {

				changedRecords[i].TimeEntryOperation = 'U';
				if (changedRecords[i].SetDraft) {
					changedRecords[i].AllowRelease = '';
					// delete changedRecords[i].SetDraft;
				} else {
					changedRecords[i].AllowRelease = 'X';
					// delete changedRecords[i].SetDraft;
				}

			}
			for (var i = 0; i < newRecords.length; i++) {

				newRecords[i].TimeEntryOperation = 'C';
				if (newRecords[i].SetDraft) {
					newRecords[i].AllowRelease = '';
					// delete changedRecords[i].SetDraft;
				} else {
					newRecords[i].AllowRelease = 'X';
					// delete changedRecords[i].SetDraft;
				}
			}
			if (changedRecords.length > 0) {
				for (var i = 0; i < changedRecords.length; i++) {
					timeEntries.push(changedRecords[i]);
				}
			}
			if (newRecords.length > 0) {
				for (var i = 0; i < newRecords.length; i++) {
					timeEntries.push(newRecords[i]);
				}
			}
			for (var i = 0; i < timeEntries.length; i++) {
				if (checkOnly === "X") {
					timeEntries[i].CheckOnly = "X";
				} else {
					timeEntries[i].CheckOnly = "";
				}
				timeEntries[i].RecRowNo = (i + 1).toString();
				if (timeEntries[i].TimeEntryDataFields.CATSHOURS === "") {
					timeEntries[i].TimeEntryDataFields.CATSHOURS = "0.00";
				}
			}
			var copiedEntries = $.extend(true, [], timeEntries);
			for (var i = 0; i < copiedEntries.length; i++) {
				delete copiedEntries[i].target;
				delete copiedEntries[i].total;
				delete copiedEntries[i].addButton;
				delete copiedEntries[i].addButtonEnable;
				delete copiedEntries[i].deleteButtonEnable;
				delete copiedEntries[i].deleteButton;
				delete copiedEntries[i].TimeEntryDataFields.ERSDA;
				delete copiedEntries[i].TimeEntryDataFields.LAEDA;
				delete copiedEntries[i].TimeEntryDataFields.LAETM;
				delete copiedEntries[i].TimeEntryDataFields.ERSTM;
				delete copiedEntries[i].TimeEntryDataFields.APDAT;
				delete copiedEntries[i].HeaderData;
				delete copiedEntries[i].highlight;
				delete copiedEntries[i].SetDraft;
				delete copiedEntries[i].valueStateText;
				delete copiedEntries[i].valueState;
				delete copiedEntries[i].missing;
				delete copiedEntries[i].currentMissing;
				delete copiedEntries[i].sendButton;
				delete copiedEntries[i].total;
				copiedEntries[i].TimeEntryDataFields.WORKDATE = this.formatter.formatToBackendString(copiedEntries[i].TimeEntryDataFields.WORKDATE) +
					"T00:00:00";
				copiedEntries[i].TimeEntryDataFields.CATSHOURS = parseFloat(copiedEntries[i].TimeEntryDataFields.CATSHOURS).toFixed(2);
			}
			/**
			 * @ControllerHook Modify the post object
			 * This hook method can be used to modify the object before the post call
			 * It is called when the decision options for the detail item are fetched successfully
			 * @callback hcm.mytimesheet.view.S3~extHookChangeObjectBeforeSubmit
			 * @param {object} Post Object
			 * @return {object} Final Post Object
			 */

			if (this.extHookChangeObjectBeforeSubmit) {
				copiedEntries = this.extHookChangeObjectBeforeSubmit(copiedEntries);
			}
			return copiedEntries;
		},
		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function () {},

		onSearch: function (oEvent) {

		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function () {
			// var oTable = this.byId("table");
			// oTable.getBinding("items").refresh();
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Shows the selected item on the object page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showObject: function (oItem) {
			// this.getRouter().navTo("object", {
			// 	objectId: oItem.getBindingContext().getProperty("EmployeeID")
			// });
		},
		/*		onAssignmentsLoaded: function (oEvent) {
					var assignmentId = oEvent.getParameter("defaultAssignment");
					this._changeAssignment(assignmentId);
				},*/
		onAssignmentSwitch: function (oEvent) {

			var assignmentId = oEvent.getParameter("selectedAssignment");
			this._changeAssignment(assignmentId, false);

		},
		_changeAssignment: function (assignmentId, firstTime) {
			var that = this;
			//pass it to CE and onbehalf controls
			that.resetAdHocControls();
			//Initializing adhoc todo controls
			that.resetTodoAdHocControls();
			this.byId("toolBtnCE").setAssignmentId(assignmentId);
			this.byId("toolBtnOB").setAssignmentId(assignmentId);

			//remember pernr display settings
			CommonModelManager.getAssignmentInformation(assignmentId, "MYTIMESHEET").then(function (oAssignment) {
				var oControlsModel = that.getModel("controls");
				oControlsModel.setProperty("/showEmployeeNumber", oAssignment.ShowEmployeeNumber);
				oControlsModel.setProperty("/showEmployeeNumberWithoutZeros", oAssignment.ShowEmployeeNumberWithoutZeros);
			});

			this.empID = assignmentId;
			this.setPernr(this.empID);
			this.initPernr(this.empID);
			if (firstTime) {
				this.showBusy();
				this.getFieldTexts("UNIT");
			}
			this.getEmployeeDetails(this.empID);
			that.oDataModel = that.getOwnerComponent().getModel();
			var a = new sap.ui.model.Filter({
				path: "Pernr",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.empID
			});
			var f = [];
			f.push(a);
			var mParameters = {
				filters: f,
				success: function (oData, oResponse) {

					that.completeTextFields = {}; //Storing the attributes parmater
					var rank = 1;

					for (var i = 0; i < oData.results.length; i++) {
						that.completeTextFields[oData.results[i].Attributes] = rank;
						rank++;
						try {
							if (oData.results[i].Attributes) {
								that.getFieldTexts(oData.results[i].Attributes);
							}
						} catch (exception) {
							//Invalid field name
						}
					}

					if (oData.results[0].FormEntryEnabled === 'X') {
						that.getModel('controls').setProperty('/isFormEntryEnabled', true);
					} else {
						that.getModel('controls').setProperty('/isFormEntryEnabled', false);
					}

					if (oData.results[0].FormEntryName) {
						var data = oData.results[0].FormEntryName;
						that.formEntryName = data;

					} else {
						var data = that.getModel("i18n").getResourceBundle().getText('formEntry');
						that.formEntryName = data;
					}

					that.minNavDate = new Date(oData.results[0].CaleNavMinDate.getUTCFullYear(), oData.results[0].CaleNavMinDate.getUTCMonth(),
						oData.results[
							0].CaleNavMinDate.getUTCDate());
					that.maxNavDate = new Date(oData.results[0].CaleNavMaxDate.getUTCFullYear(), oData.results[0].CaleNavMaxDate.getUTCMonth(),
						oData.results[
							0].CaleNavMaxDate.getUTCDate());
					if (oData.results[0].CheckEnabled && oData.results[0].CheckEnabled === "X") {
						that.checkButtonNeeded = "X";
					}
					if (oData.results[0].ProgressFixed === 'X') {
						that.getModel("controls").setProperty('/fixProgressIndicator', true);
					} else {
						that.getModel("controls").setProperty('/fixProgressIndicator', false);
					}
					that.profileId = oData.results[0].ProfileId;
					that.getProfileFields(that.empID, that.profileId);
					that.getWorklistFields(that.empID, that.profileId);
					that.getTasks(true, that.minNavDate, that.maxNavDate);
					that.getTimeEntries(that.dateFrom, that.dateTo);
					that.getToDoList();
					//Handling On-Behalf message strip
					if (sap.ui.Device.system.phone === true) {
						if (that.byId("toolBtnOB").getOnBehalfEmployeeId()) {
							that.byId("overviewOnBehalfIndicator").getAggregation("_messagestrip").setText(that.oBundle.getText("onBehalf"));
							that.byId("overviewOnBehalfIndicator").setVisible(true);
						} else {
							that.byId("overviewOnBehalfIndicator").setVisible(false);
						}
					}
				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			that.oDataModel.read(that.appendLocaleParameter("/WorkCalendarCollection"), mParameters);

		},
		onSwitchProfile: function (oEvent) {
			var that = this;
			that.ProfilesModel = that.getOwnerComponent().getModel();

			var mProfilesParameters = {
				success: function (oData) {
					var oProfilesModel = new sap.ui.model.json.JSONModel(oData.results);
					that.getView().setModel(oProfilesModel, "ProfilesModel");
					var profileListRef = that.byId("SwitchProfileList");
					for (var q = 0; q < profileListRef.getItems().length; q++) {
						if (profileListRef.getItems()[q].getTitle() === that.profileId) {
							profileListRef.getItems()[q].setSelected(true);
						}
					}
					that.profileSwitched = true;
				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			that.ProfilesModel
				.read(that.appendLocaleParameter("/MultipleProfilesSet"), mProfilesParameters);
			// create dialog lazily
			if (!that.oSwitchProfileDialog) {
				var oDialogController = {
					onConfirm: function (evnt) {
						var profileListRef = that.byId("SwitchProfileList");
						if (profileListRef.getSelectedItem() !== null) {
							var selectedProfile = profileListRef.getSelectedItem().getCustomData()[0].getProperty("value");
						}
						that.resetAdHocControls();
						//Initializing adhoc todo controls
						that.resetTodoAdHocControls();
						that.profileId = selectedProfile;
						that.getEmployeeDetails(that.empID);
						that.oDataModel = that.getOwnerComponent().getModel();
						var a = new sap.ui.model.Filter({
							path: "Pernr",
							operator: sap.ui.model.FilterOperator.EQ,
							value1: that.empID
						});
						var b = new sap.ui.model.Filter({
							path: "ProfileId",
							operator: sap.ui.model.FilterOperator.EQ,
							value1: that.profileId
						});
						var f = [];
						f.push(a);
						f.push(b);
						var mParameters = {
							filters: f,
							success: function (oData, oResponse) {
								that.minNavDate = new Date(oData.results[0].CaleNavMinDate.getUTCFullYear(), oData.results[0].CaleNavMinDate.getUTCMonth(),
									oData.results[
										0].CaleNavMinDate.getUTCDate());
								that.maxNavDate = new Date(oData.results[0].CaleNavMaxDate.getUTCFullYear(), oData.results[0].CaleNavMaxDate.getUTCMonth(),
									oData.results[
										0].CaleNavMaxDate.getUTCDate());
								that.getProfileFields(that.empID, that.profileId);
								that.getWorklistFields(that.empID, that.profileId);
								that.getTasks(true, that.minNavDate, that.maxNavDate);
								that.getTimeEntries(that.dateFrom, that.dateTo);
								that.getToDoList();
							},
							error: function (oError) {
								that.oErrorHandler.processError(oError);
							}
						};
						that.oDataModel.read(that.appendLocaleParameter('/WorkCalendarCollection'), mParameters);
						that.oSwitchProfileDialog.close();
					},
					onCancel: function (evnt) {
						that.oSwitchProfileDialog.close();
					}
				};
				// create dialog via fragment factory
				that.oSwitchProfileDialog = sap.ui.xmlfragment(that.getView().getId(),
					"hcm.fab.mytimesheet.view.fragments.SwitchProfilePopOver",
					oDialogController);
				// connect dialog to view (models, lifecycle)
				that.getView().addDependent(that.oSwitchProfileDialog);
			}
			jQuery.sap.syncStyleClass("sapUiSizeCompact", that.getView(), that.oSwitchProfileDialog);
			that.oSwitchProfileDialog.open();
		},
		getEmployeeDetails: function (empID) {
			var that = this;
			var oModel = new JSONModel();
			var f = [];
			var c = new sap.ui.model.Filter({
				path: "EmployeeNumber",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.empID
			});
			f.push(c);
			this.oCEModel.metadataLoaded().then(function () {
				var entity = that.oCEModel.createKey("EmployeeDetailSet", {
					EmployeeNumber: empID,
					ApplicationId: "MYTIMESHEET"
				});
				var mParameters = {
					success: function (result, oResponse) {
						result.EmployeeNumber = parseInt(result.EmployeeNumber, 10);
						result.EmployeeOrgunitId = parseInt(result.EmployeeOrgunitId, 10);
						oModel.setData(result);
						that.setModel(oModel, "libCommon");
					},
					error: function (oError) {
						that.oErrorHandler.processError(oError);
					}
				};
				that.oCEModel.read(that.appendLocaleParameter('/' + entity), mParameters);
			});
		},

		onTaskAll: function (oEvent) {
			var oFilter = [];
			this.oTaskTable.getBinding('items').filter(oFilter);
		},
		onTaskActive: function (oEvent) {
			var oFilter = [];
			var selectedKey = true;
			oFilter.push(new Filter("AssignmentStatus", FilterOperator.EQ, selectedKey));

			this.oTaskTable.getBinding('items').filter(oFilter);
		},
		onTaskInactive: function (oEvent) {
			var oFilter = [];
			var selectedKey = false;
			oFilter.push(new Filter("AssignmentStatus", FilterOperator.EQ, selectedKey));
			this.oTaskTable.getBinding('items').filter(oFilter);
		},
		worklistRouteMatched: function (oEvent) {
			var oModel = this.getGlobalModel("TaskReload");
			var oControls = this.getGlobalModel("controls");
			if (oModel) {
				var oTasks = oModel.getData();
				if (oTasks.reloadTasks) {
					var controls = oControls.getData();
					if (controls.copyAssignment) {
						var toastMsg = this.oBundle.getText("copyAssignmentSaved");
					} else if (controls.editAssignment) {
						var toastMsg = this.oBundle.getText("editAssignmentSaved");
					} else {
						var toastMsg = this.oBundle.getText("createAssignmentSaved");
					}
					//var toastMsg = this.oBundle.getText("taskSaved");
					this.getTasks(false, this.minNavDate, this.maxNavDate);
					sap.m.MessageToast.show(toastMsg, {
						duration: 5000
					});
					oTasks.reloadTasks = false;
				}
			}

			if (oControls && oControls.getProperty('/groupReload') === true && !this.assignmentGroupWithNoAssignment) {
				var assignmentGroupWithNoAssignment = this.getGlobalModel("assignmentGroupWithNoAssignment").getData();
				if (assignmentGroupWithNoAssignment.groupName) {
					var toastMsg = this.oBundle.getText("assignmentGroupDeleteWithNoAssignment", [assignmentGroupWithNoAssignment.groupName]);
				} else if (oControls.getData().DeleteGroup) {
					var toastMsg = this.oBundle.getText("deleteGroupAssignment");
				} else if (oControls.getData().editGroup) {
					var toastMsg = this.oBundle.getText("editGroupSaved");
				} else {
					var toastMsg = this.oBundle.getText("createGroupSaved");
				}
				//var toastMsg = this.oBundle.getText("performGroup");
				this.setGlobalModel(new JSONModel({}), "assignmentGroupWithNoAssignment");
				this.setGlobalModel(new JSONModel({}), "assignmentGroupWithNoAssignment");
				this.getTasks(false, this.minNavDate, this.maxNavDate);
				sap.m.MessageToast.show(toastMsg, {
					duration: 5000
				});
				oControls.setProperty('/groupReload', false);
			}
			// this.getToDoList();
		},
		onMenuAction: function (oEvent) {
			if (oEvent.getParameter("item").getKey() === "selectFromWorklist") {
				this.onImportWorklist();
			} else if (oEvent.getParameter("item").getKey() === "selectFromAdminlist") {
				this.onImportAdminlist();
			} else if (oEvent.getParameter("item").getKey() === "selectFromAssignment") {
				this.onTaskCreate(oEvent);
			} else if (oEvent.getParameter("item").getKey() === "selectFromGroups") {
				this.onCreateGroup(oEvent);
			}
		},
		onImportWorklist: function (oEvent) {
			var that = this;
			this.showBusy();
			var oModel = new JSONModel();
			var oModel_wlist = new JSONModel(); //Note
			var worklist = {};
			var worklistEntry = [];
			var data;
			var mParameters = {
				success: function (oData, oResponse) {
					oModel.setData(oData.results);
					oModel_wlist.setData(oData.results); //Note
					that.setModel(oModel_wlist, "Worklist"); //Note
					// that.setModel(oModel, "Worklist");
					data = oData.results;
					var worklistProfileFields = that.getModel("WorklistProfileFields").getData();
					for (var j = 0; j < data.length; j++) {
						for (var i = 0; i < worklistProfileFields.length; i++) {
							if (data[j].WorkListDataFields[worklistProfileFields[i].FieldName] !== undefined) {
								worklist[worklistProfileFields[i].FieldName] = data[j].WorkListDataFields[worklistProfileFields[i].FieldName];
							} else {
								worklist[worklistProfileFields[i].FieldName] = "";
							}
						}
						var finaltask = $.extend(true, {}, worklist);
						worklistEntry.push(finaltask);
						oModel.setData(worklistEntry);
						that.setModel(oModel, "WorklistFields");
					}
					if (that.getModel('controls').getProperty('/currentAdHoc') || that.getModel('controls').getProperty('/currentTodoAdHoc')) {
						that.adHocWorklistPopover();

					} else {
						that.worklistPopover();
					}

					that.hideBusy(true);
				},
				error: function (oError) {
					that.hideBusy(true);
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.read(that.appendLocaleParameter('/WorkListCollection'), mParameters);
		},
		onImportAdminlist: function (oEvent) {
			var that = this;
			this.showBusy();
			var oModel = new sap.ui.model.json.JSONModel();
			var AdminTaskModel = new sap.ui.model.json.JSONModel();
			// var oControl;
			var obj;
			var AdminTaskFields = [];
			var adminTask = {};
			var a = new sap.ui.model.Filter({
				path: "Pernr",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.empID
			});
			var b = new sap.ui.model.Filter({
				path: "ValidityStartDate",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: new Date()
			});
			var c = new sap.ui.model.Filter({
				path: "ValidityEndDate",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: new Date()
			});
			var d = new sap.ui.model.Filter({
				path: "AdminAssignmentFlag",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: "X"
			});
			var f = [];
			f.push(b);
			f.push(c);
			f.push(a);
			f.push(d);
			var mParameters = {
				filters: f,
				success: function (oData, oResponse) {
					var tempDate;
					for (var l = 0; l < oData.results.length; l++) {
						try {
							tempDate = new Date(oData.results[l].ValidityStartDate);
							oData.results[l].ValidityStartDate = new Date(tempDate.getUTCFullYear(), tempDate.getUTCMonth(), tempDate.getUTCDate());
							tempDate = new Date(oData.results[l].ValidityEndDate);
							oData.results[l].ValidityEndDate = new Date(tempDate.getUTCFullYear(), tempDate.getUTCMonth(), tempDate.getUTCDate());
						} catch (o) {
							//retain dates in local format
						}
					}
					that.adminTasks = oData.results;
					oModel.setData(that.adminTasks);
					that.setModel(oModel, "AdminTasks");
					if (that.adminTasks.length === 0) {
						that.noAssignmentsDialog();
					}
					for (var j = 0; j < that.adminTasks.length; j++) {
						for (var i = 0; i < that.profileFields.length; i++) {
							if (that.profileFields[i].FieldName === "APPROVER" || that.profileFields[i].FieldName === "AssignmentStatus" || that.profileFields[
									i].FieldName === "AssignmentName" || that.profileFields[i].FieldName === "ValidityStartDate" || that.profileFields[i].FieldName ===
								"ValidityEndDate") {
								if (that.profileFields[i].FieldName === "AssignmentStatus") {
									adminTask[that.profileFields[i].FieldName] = that.adminTasks[j][that.profileFields[i].FieldName] === "1" ? true : false;
								} else if (that.profileFields[i].FieldName === "ValidityStartDate") {
									adminTask[that.profileFields[i].FieldName] = that.adminTasks[j][that.profileFields[i].FieldName];
								} else if (that.profileFields[i].FieldName === "ValidityEndDate") {
									adminTask[that.profileFields[i].FieldName] = that.adminTasks[j][that.profileFields[i].FieldName];
								} else if (that.profileFields[i].FieldName === "APPROVER") {
									adminTask["APPROVER"] = that.adminTasks[j].ApproverId;
								} else {
									adminTask[that.profileFields[i].FieldName] = that.adminTasks[j][that.profileFields[i].FieldName];
								}
							} else {
								adminTask[that.profileFields[i].FieldName] = that.adminTasks[j].AssignmentFields[that.profileFields[i].FieldName];
								//Display text only if it enabled via BAdI hcmfab_b_tsh_textfields in the backend
								// if (that.profileFields[i].DispValueText === "TRUE") {
								that.getFieldTexts(that.profileFields[i].FieldName);
								// }
							}

						}
						var finaltask = $.extend(true, {}, adminTask);
						AdminTaskFields.push(finaltask);
					}
					// obj = $.grep(AdminTaskFields, function (element, ind) {
					// 	return element.AssignmentStatus === true;
					// });
					AdminTaskModel.setData(AdminTaskFields);
					that.setModel(AdminTaskModel, "AdminTaskFields");
					that.adminlistPopover();
					that.hideBusy(true);
				},
				error: function (oError) {
					that.hideBusy(true);
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.read(that.appendLocaleParameter('/AssignmentCollection'), mParameters);
		},
		getWorklistFields: function (oPernr) {
			var that = this;
			var oModel = new sap.ui.model.json.JSONModel();
			var a = new sap.ui.model.Filter({
				path: "Pernr",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: oPernr
			});
			var b = new sap.ui.model.Filter({
				path: "SelWorkList",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: "X"
			});
			var f = [];
			f.push(a);
			f.push(b);
			if (that.profileId) {
				var c = new sap.ui.model.Filter({
					path: "ProfileId",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: that.profileId
				});
				if (that.profileId !== undefined) {
					f.push(c);
				}
			}
			var mParameters = {
				filters: f,
				success: function (oData, oResponse) {
					var worklistFields = $.extend(true, [], oData.results);
					that.readOnlyTemplate();

					//add Name Field to WorklistFields
					var nameField = [];
					nameField.FieldName = "NAME";
					nameField.FieldLength = 30;
					nameField.FieldType = "C";
					nameField.IsReadOnly = "FALSE";
					nameField.SelWorkList = "X";
					nameField.FieldLabel = that.oBundle.getText("name");
					worklistFields.splice(0, 0, nameField);

					//add Range Field to WorklistFields
					var rangeField = [];
					rangeField.FieldName = "RANGE";
					rangeField.FieldLabel = that.oBundle.getText("validPeriod");
					rangeField.IsReadOnly = "FALSE";
					rangeField.SelWorkList = "X";
					worklistFields.splice(1, 0, rangeField);

					oModel.setData(worklistFields);
					that.worklistFields = worklistFields;
					that.setModel(oModel, "WorklistProfileFields");
					// that.setGlobalModel(oModel, "WorklistFields");
				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.read(that.appendLocaleParameter('/ProfileFieldCollection'), mParameters);
		},
		worklistPopover: function () {
			// create popover
			var that = this;
			var oDialogController = {
				handleClose: function (event) {
					that._oPopover.close();
					that._oPopover.destroy();
				},
				handleConfirm: function (event) {
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
						Pernr: that.empID,
						ProfileId: "",
						ValidityStartDate: "",
						ValidityEndDate: ""
					};
					var selectedItems = [];
					var selectedItemsCount = 0;
					var worklistTable = that.byId("worklistTableId");
					var oItems = worklistTable.getItems();
					var worklistData = that.getModel("Worklist").getData();
					var checkFlag = "";
					for (var i = 0; i < oItems.length; i++) {
						if (oItems[i].getProperty("selected") == true) {
							selectedItemsCount++;
							for (var j = 0; j < that.worklistFields.length; j++) {
								if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "NAME") {
									if (oItems[i].getCells()[j].getValue() === "") {
										oItems[i].getCells()[j].setValueState(sap.ui.core.ValueState.Error);
										//Set a flag for avoiding incorrect Import
										checkFlag = "X";
									}
									TaskData["AssignmentName"] = oItems[i].getCells()[j].getValue();
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "APPROVER") {
									TaskData["ApproverName"] = oItems[i].getCells()[j].getValue();
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "AssignmentStatus") {
									TaskData["AssignmentStatus"] = oItems[i].getCells()[j].getValue() ? "1" : "";
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "RANGE") {
									TaskData["ValidityStartDate"] = that.formatter.formatToBackendString(oItems[i].getCells()[j].getDateValue()) +
										"T00:00:00";
									TaskData["ValidityEndDate"] = that.formatter.formatToBackendString(oItems[i].getCells()[j].getSecondDateValue()) +
										"T00:00:00";
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "CPR_TEXT") {
									//Do nothing - Continue
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "CPR_OBJTEXT") {
									//Do nothing - Continue
								} else {
									// TaskData.AssignmentFields[oItems[i].getCells()[j].getCustomData()[0].getValue()] =
									// 	oItems[i].getCells()[j].getText();

									TaskData.AssignmentFields[oItems[i].getCells()[j].getCustomData()[0].getValue()] = worklistData[oItems[i].getBindingContext(
										"WorklistFields").getPath().split("/")[1]].WorkListDataFields[oItems[i].getCells()[j].getCustomData()[0].getValue()];
								}
								if (TaskData.AssignmentFields.CPR_GUID === "") {
									TaskData.AssignmentFields.CPR_GUID = worklistData[oItems[i].getBindingContext(
										"WorklistFields").getPath().split("/")[1]].WorkListDataFields.CPR_GUID;
								}
								if (TaskData.AssignmentFields.CPR_OBJGUID === "") {
									TaskData.AssignmentFields.CPR_OBJGUID = worklistData[oItems[i].getBindingContext(
										"WorklistFields").getPath().split("/")[1]].WorkListDataFields.CPR_OBJGUID;
								}
								// var data = $.extend(true, {}, selected);
								// selectedItems.push(data);
								if (TaskData.AssignmentFields.BWGRL === "") {
									TaskData.AssignmentFields.BWGRL = "0.00";
								}
								if (TaskData.AssignmentFields.PRICE === "") {
									TaskData.AssignmentFields.PRICE = "0.00";
								}
								if (TaskData.AssignmentFields.OFMNW === "") {
									TaskData.AssignmentFields.OFMNW = "0.00";
								}
								if (TaskData.AssignmentFields.PEDD !== null) {
									TaskData.AssignmentFields.PEDD = this.formatter.formatToBackendString(new Date(TaskData.AssignmentFields.PEDD)) +
										"T00:00:00";
								}
							}
							var data = $.extend(true, {}, TaskData);
							selectedItems.push(data);
						}
					}
					if (selectedItemsCount < 1) {
						var toastMsg = that.oBundle.getText("noSelectionMade");
						sap.m.MessageToast.show(toastMsg, {
							duration: 3000
						});
					} else if (checkFlag === "X") {
						var toastMsg1 = that.oBundle.getText("fillRequiredEntries");
						sap.m.MessageToast.show(toastMsg1, {
							duration: 3000
						});
					} else {
						that.performImportAssignments(selectedItems);
						that._oPopover.close();
						that._oPopover.destroy();
					}
				},
				onNavBack: function (event) {
					var oNavCon = Fragment.byId(that.getView().getId(), "NavC");
					oNavCon.back();
				},
				onValueHelp: this.onValueHelp.bind(this),
				switchState: this.formatter.switchState.bind(this),
				dynamicBindingColumnsWorklist: this.dynamicBindingColumnsWorklist.bind(this),
				dynamicBindingRowsWorklist: this.dynamicBindingRowsWorklist.bind(this)
			};
			// if (!this._oPopover) {
			this._oPopover = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.WorklistPopover",
				oDialogController);
			this.getView().addDependent(this._oPopover);
			// }

			// delay because addDependent will do a async rerendering and the popover will immediately close without it
			jQuery.sap.delayedCall(0, this, function () {
				this._oPopover.open();
			});
		},
		adminlistPopover: function () {
			// create popover
			var that = this;
			var oDialogController = {
				handleClose: function (event) {
					that._oAdminlistPopover.close();
					that._oAdminlistPopover.destroy();
				},
				handleConfirm: function (event) {
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
						Pernr: that.empID,
						ProfileId: "",
						ValidityStartDate: "",
						ValidityEndDate: ""
					};
					var selectedItemsCount = 0;
					var selectedItems = [];
					//Fetch the selected assignments
					var adminlistTable = that.byId("adminlistTableId");
					var oItems = adminlistTable.getItems();
					for (var i = 0; i < oItems.length; i++) {
						if (oItems[i].getProperty("selected") == true) {
							selectedItemsCount++;
							for (var j = 0; j < that.profileFields.length; j++) {
								if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "AssignmentName") {
									TaskData["AssignmentName"] = oItems[i].getCells()[j].getText();
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "APPROVER") {
									TaskData["ApproverName"] = oItems[i].getCells()[j].getText();
									TaskData["ApproverId"] = oItems[i].getCells()[j].getText();
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "AssignmentStatus") {
									TaskData["AssignmentStatus"] = (oItems[i].getCells()[j].getText() === "Active") ? "1" : "";
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "ValidityStartDate") {
									TaskData["ValidityStartDate"] = that.formatter.formatToBackendString(oItems[i].getCells()[j].getText()) +
										"T00:00:00";
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "ValidityEndDate") {
									TaskData["ValidityEndDate"] = that.formatter.formatToBackendString(oItems[i].getCells()[j].getText()) +
										"T00:00:00";
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "CPR_TEXT") {
									//Do nothing - Continue
								} else if (oItems[i].getCells()[j].getCustomData()[0].getValue() == "CPR_OBJTEXT") {
									//Do nothing - Continue
								} else {
									if (oItems[i].getCells()[j].getCustomData()[2]) {
										TaskData.AssignmentFields[oItems[i].getCells()[j].getCustomData()[0].getValue()] =
											oItems[i].getCells()[j].getCustomData()[2].getValue();
									} else {
										TaskData.AssignmentFields[oItems[i].getCells()[j].getCustomData()[0].getValue()] =
											oItems[i].getCells()[j].getText();
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
								if (TaskData.AssignmentFields.PEDD !== null) {
									TaskData.AssignmentFields.PEDD = this.formatter.formatToBackendString(new Date(TaskData.AssignmentFields.PEDD)) +
										"T00:00:00";
								}
							}
							var data = $.extend(true, {}, TaskData);
							selectedItems.push(data);
						}
					}
					if (selectedItemsCount < 1) {
						var toastMsg = that.oBundle.getText("noSelectionMade");
						sap.m.MessageToast.show(toastMsg, {
							duration: 3000
						});
					} else {
						that.performImportAssignments(selectedItems);
						that._oAdminlistPopover.close();
						that._oAdminlistPopover.destroy();
					}
				},
				onNavBack: function (event) {
					var oNavCon = Fragment.byId(that.getView().getId(), "NavC");
					oNavCon.back();
				},
				dynamicBindingColumnsAdminlist: this.dynamicBindingColumnsAdminlist.bind(this),
				dynamicBindingRowsAdminlist: this.dynamicBindingRowsAdminlist.bind(this)
			};
			// if (!this._oPopover) {
			this._oAdminlistPopover = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.AdminlistPopover",
				oDialogController);
			this.getView().addDependent(this._oAdminlistPopover);
			// }

			// delay because addDependent will do a async rerendering and the popover will immediately close without it
			jQuery.sap.delayedCall(0, this, function () {
				this._oAdminlistPopover.open();
			});
		},
		clockTimesPopOver: function (oEvent) {
			// create popover
			var that = this;
			var oDialogController = {
				handleClose: function (event) {
					that._oPopover.close();
					that._oPopover.destroy();
				},
				handleOk: function (event) {
					var index = oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1];
					var data = that.getModel('TimeData').getData();
					if (that.clockTimeChange) {
						data[index].TimeEntryDataFields.BEGUZ = that.formatter.convertTime(oEvent.getSource().getParent().getAggregation('content')[
								0]
							.getAggregation('content')[0].getDateValue());
						data[index].TimeEntryDataFields.ENDUZ = that.formatter.convertTime(oEvent.getSource().getParent().getAggregation('content')[
								0]
							.getAggregation('content')[1].getDateValue());
						if (data[index].Counter !== "") {
							data[index].TimeEntryOperation = 'U';
						} else {
							data[index].TimeEntryOperation = 'C';
						}
						var oModel = new JSONModel(data);
						that.setModel(oModel, "TimeData");
					}
					that._oPopover.close();
					that._oPopover.destroy();
				},
				handleChange: function (oEvent) {
					that.clockTimeChange = true;
				},
				formatTime: this.formatter.formatTime.bind(this)
			};
			var data = $.extend(true, [], this.getModel('TimeData').getData());
			var oModel = new JSONModel(data);
			this.setModel(oModel, "oldModel");
			// if (!this._oPopover) {
			this._oPopover = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.ClockTimesPopOver",
				oDialogController);
			this._oPopover.bindElement('TimeData>' + oEvent.getSource().getBindingContext('TimeData').getPath());
			this.getView().addDependent(this._oPopover);

			// }

			// delay because addDependent will do a async rerendering and the popover will immediately close without it
			jQuery.sap.delayedCall(0, this, function () {
				this._oPopover.open(oEvent.getSource());
			});
		},
		readOnlyTemplate: function () {
			// this.oReadOnlyTemplate = this.oTable.removeItem(0);
			this.oReadOnlyTemplate = new sap.m.ColumnListItem({
				cells: [
					new sap.m.ObjectStatus({
						text: {
							parts: [{
								path: 'TimeData>totalHours',
								type: 'sap.ui.model.odata.type.Decimal',
								formatOptions: {
									parseAsString: true,
									decimals: 2,
									maxFractionDigits: 2,
									minFractionDigits: 0
								},
								constraints: {
									precision: 4,
									scale: 2,
									minimum: '0',
									maximum: '10000'
								}
							}, {
								path: 'TimeData>target',
								type: 'sap.ui.model.odata.type.Decimal',
								formatOptions: {
									parseAsString: true,
									decimals: 2,
									maxFractionDigits: 2,
									minFractionDigits: 0
								},
								constraints: {
									precision: 4,
									scale: 2,
									minimum: '0',
									maximum: '10000'
								}
							}],
							formatter: formatter.concatStrings
						},
						visible: true
					}),
					new sap.m.Link({
						text: {
							parts: [{
								path: 'TimeData>AssignmentName'
							}, {
								path: 'TimeData>AssignmentId'
							}, {
								path: 'TimeData>Counter'
							}, {
								path: 'TimeData>Status'
							}],

							formatter: this.formatter.assignmentName.bind(this)
						},
						tooltip: {
							parts: [{
								path: 'TimeData>AssignmentName'
							}, {
								path: 'TimeData>AssignmentId'
							}, {
								path: 'TimeData>Counter'
							}, {
								path: 'TimeData>Status'
							}],

							formatter: this.formatter.assignmentName.bind(this)
						},
						press: this.onAssignmentQuickView.bind(this)
					}),
					new sap.m.Button({
						tooltip: this.oBundle.getText("edit"),
						icon: "sap-icon://edit-outside",
						type: "Transparent",
						enabled: false,
						press: this.loadAdHocFragment.bind(this),
						visible: false
					}),

					new sap.m.Button({
						icon: "sap-icon://message-information",
						type: sap.m.ButtonType.Transparent,
						press: this.onAssignmentQuickView.bind(this),
						// visible: "{TimeData>addButton}",
						// visible: {
						// 	parts: [{
						// 		path: 'TimeData>AssignmentId'
						// 	}, {
						// 		path: 'TimeData>Counter'
						// 	}],

						// 	formatter: this.formatter.infoEnabled
						// }
						visible: false
					}),

					new sap.m.ObjectNumber({
						number: {
							parts: [{
								path: 'TimeData>TimeEntryDataFields/CATSHOURS'
							}, {
								path: 'TimeData>TimeEntryDataFields/CATSQUANTITY'
							}, {
								path: 'TimeData>TimeEntryDataFields/CATSAMOUNT'
							}],
							formatter: formatter.calHoursQuanAmount.bind(this)
						},
						unit: {
							parts: [{
								path: 'TimeData>TimeEntryDataFields/UNIT'
							}, {
								path: 'TimeData>TimeEntryDataFields/CATSHOURS'
							}],
							formatter: formatter.getUnitTexts.bind(this)
						}
					}),
					new sap.m.CheckBox({
						editable: false,
						visible: this.draftStatus,
						selected: "{TimeData>SetDraft}"
					}),
					// new sap.m.Button({
					// 	icon: "sap-icon://activity-items",
					// 	type: sap.m.ButtonType.Transparent,
					// 	press: this.onReadOnlyProjectDetails.bind(this),
					// 	visible: {
					// 		parts: [{
					// 			path: 'TimeData>TimeEntryDataFields/CPR_GUID'
					// 		}, {
					// 			path: 'TimeData>TimeEntryDataFields/CPR_OBJGUID'
					// 		}],
					// 		formatter: this.formatter.projectsVisible.bind(this)
					// 	}
					// }),
					//
					new sap.m.ObjectStatus({
						text: {
							parts: [{
								path: 'TimeData>TimeEntryDataFields/BEGUZ'
							}, {
								path: 'TimeData>TimeEntryDataFields/ENDUZ'
							}],
							formatter: this.formatter.formatStartReadOnlyTime.bind(this)
						},
						visible: this.clockTimeVisible
					}),
					new sap.m.ObjectStatus({
						text: {
							parts: [{
								path: 'TimeData>TimeEntryDataFields/BEGUZ'
							}, {
								path: 'TimeData>TimeEntryDataFields/ENDUZ'
							}],
							formatter: this.formatter.formatEndReadOnlyTime.bind(this)
						},
						visible: this.clockTimeVisible
					}),
					new sap.m.CheckBox({
						editable: false,
						visible: this.previousDayIndicator,
						selected: {
							path: 'TimeData>TimeEntryDataFields/VTKEN',
							formatter: formatter.checkPrevDay
						}
					}),
					new sap.m.ObjectStatus({
						text: {
							path: 'TimeData>TimeEntryDataFields/STATUS',
							formatter: formatter.status
						},
						state: {
							path: 'TimeData>TimeEntryDataFields/STATUS',
							formatter: formatter.state
						}
					}),
					new sap.m.Button({
						icon: "sap-icon://notification-2",
						type: sap.m.ButtonType.Transparent,
						tooltip: this.getModel("i18n").getResourceBundle().getText('comment'),
						press: this.displaylongtextPopover.bind(this),
						enabled: {
							parts: [{
								path: 'TimeData>TimeEntryDataFields/LONGTEXT'
							}, {
								path: 'TimeData>RejReasondesc'
							}],
							formatter: formatter.enabled
						},
						visible: {
							parts: [{
								path: 'TimeData>TimeEntryDataFields/LONGTEXT'
							}, {
								path: 'TimeData>RejReasondesc'
							}],
							formatter: formatter.visibility
						}
					}),
					new sap.m.Text({
						text: {
							parts: [{
								path: 'TimeData>TimeEntryDataFields'
							}, {
								path: 'OverviewAttributes>/state'
							}],
							formatter: formatter.ConcatenateText.bind(this)
						}
					}),

				],
				customData: [new sap.ui.core.CustomData({
					key: "counter",
					value: "{TimeData>Counter}"
				})]
			});

			/**
			 * @ControllerHook Modify or add columns to the Overview table in read only mode
			 * This hook method can be used to modify the object before binding
			 * It is called when the decision options for the detail item are fetched successfully
			 * @callback hcm.mytimesheet.view.S3~extHookReadOnlyOverview
			 * @param {object} Post Object
			 * @return {object} Final Post Object
			 */
			if (this.extHookReadOnlyOverview) {
				this.oReadOnlyTemplate = this.extHookReadOnlyOverview(this.oReadOnlyTemplate);
			}

			this.oTable.bindItems({
				path: 'TimeData>/',
				sorter: [new sap.ui.model.Sorter("HeaderData", false, true, this.compareRows)
					// , new sap.ui.model.Sorter(
					// 	"TimeEntryDataFields/CATSHOURS", true, false)
				],
				template: this.oReadOnlyTemplate,
				templateShareable: true,
				groupHeaderFactory: this.getGroupHeader.bind(this)
			});

		},
		clockTimesToDoPopOver: function (oEvent) {
			// create popover
			var that = this;
			var oDialogController = {
				handleClose: function (event) {
					that._oPopover.close();
					that._oPopover.destroy();
				},
				handleOk: function (event) {
					var index = oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1];
					var data = that.getModel('TodoList').getData();
					if (that.clockTimeChange) {
						data[index].TimeEntryDataFields.BEGUZ = that.formatter.convertTime(oEvent.getSource().getParent().getAggregation('content')[
								0]
							.getAggregation('content')[0].getDateValue());
						data[index].TimeEntryDataFields.ENDUZ = that.formatter.convertTime(oEvent.getSource().getParent().getAggregation('content')[
								0]
							.getAggregation('content')[1].getDateValue());
						if (data[index].Counter !== "") {
							data[index].TimeEntryOperation = 'U';
						} else {
							data[index].TimeEntryOperation = 'C';
						}
						var oModel = new JSONModel(data);
						that.setModel(oModel, "TodoList");
					}
					that._oPopover.close();
					that._oPopover.destroy();
				},
				handleChange: function (oEvent) {
					that.clockTimeChange = true;
				},
				formatTime: this.formatter.formatTime.bind(this)
			};
			var data = $.extend(true, [], this.getModel('TodoList').getData());
			var oModel = new JSONModel(data);
			this.setModel(oModel, "oldModel");
			// if (!this._oPopover) {
			this._oPopover = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.ClockTimesPopOver",
				oDialogController);
			this._oPopover.bindElement('TodoList>' + oEvent.getSource().getBindingContext('TodoList').getPath());
			this.getView().addDependent(this._oPopover);

			// }

			// delay because addDependent will do a async rerendering and the popover will immediately close without it
			jQuery.sap.delayedCall(0, this, function () {
				this._oPopover.open(oEvent.getSource());
			});
		},
		clockTimeChange: function (oEvent) {
			this.clockTimeChange = true;
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
		onAssignmentPress: function (oEvent) {
			// if (sap.ui.Device.system.phone === true) {
			var that = this;
			var oView = this.getView();
			var oTable = this.byId('idTasks');
			oTable.setBusy(true);
			var oModel = new JSONModel();
			var oModel1 = new JSONModel();
			var data = this.getModel('ProfileFields').getData();
			var tasks = this.getModel('Tasks').getData();
			var index = parseInt(oEvent.getSource().getBindingContext('TaskFields').getPath().split('/')[1]);
			var oControl = this.getModel("controls");
			var formElements = [];
			var formContainers = [];
			var form = {
				name: null,
				status: false,
				containers: null
			};
			var oAssignmentModel = new JSONModel();
			oAssignmentModel.setData(tasks[index]);
			this.setGlobalModel(oAssignmentModel, "selectedAssignment");
			oControl.setProperty('/createAssignment', false);
			oControl.setProperty('/editAssignment', false);
			oControl.setProperty('/displayAssignment', true);
			oControl.setProperty('/copyAssignment', false);
			oControl.setProperty('/assignmentTitle', this.oBundle.getText("displayAssignment"));
			this.setGlobalModel(oControl, "controls");
			var selectedTask = oEvent.getSource().getAggregation('cells');
			var profileFields = $.extend(true, [], this.getModel('ProfileFields').getData());
			for (var i = 0; i < selectedTask.length; i++) {
				var obj = $.grep(profileFields, function (element, index) {
					return element.FieldName == selectedTask[i].getCustomData('FieldName')[0].getValue();
				});
				if (selectedTask[i].getCustomData('FieldName')[0].getValue() !== "AssignmentStatus" && selectedTask[i].getCustomData(
						'FieldName')[
						0].getValue() !== "AssignmentName" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityStartDate" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityEndDate" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "APPROVER") {
					if (selectedTask[i].getCustomData('FieldName')[0].getValue() !== 'RPROJ') {
						if (tasks[index].AssignmentFields[selectedTask[i].getCustomData('FieldName')[0].getValue()] !== undefined) {
							obj[0].FieldValue = tasks[index].AssignmentFields[selectedTask[i].getCustomData('FieldName')[0].getValue()];
						}
					} else {
						if (tasks[index].AssignmentFields[selectedTask[i].getCustomData('FieldName')[0].getValue()] !== undefined) {
							obj[0].FieldValue = tasks[index].AssignmentFields[selectedTask[i].getCustomData('FieldName')[0].getValue()];
							obj[0].FieldValueText = tasks[index].AssignmentFields['POSID'];
						}
					}

					obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
				} else {
					if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentStatus") {
						obj[0].FieldValue = selectedTask[i].getAggregation('customData')[2].getValue();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentName") {
						obj[0].FieldValue = selectedTask[i].getText();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityStartDate") {
						obj[0].FieldValue = selectedTask[i].getAggregation('customData')[2].getValue();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityEndDate") {
						obj[0].FieldValue = selectedTask[i].getAggregation('customData')[2].getValue();
						obj[0].AssignmentId = selectedTask[i].getAggregation('customData')[1].getValue();
					} else if (selectedTask[i].getCustomData('FieldName')[
							0].getValue() === "APPROVER") {
						obj[0].FieldValue = tasks[index].ApproverId;
					}
				}
				if (selectedTask[i].getCustomData('FieldName')[0].getValue() !== "AssignmentName" && selectedTask[i].getCustomData('FieldName')[
						0]
					.getValue() !== "AssignmentStatus" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityStartDate" && selectedTask[i].getCustomData('FieldName')[
						0].getValue() !== "ValidityEndDate") {
					formElements.push(obj[0]);
				} else {
					if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentName") {
						form.name = obj[0].FieldValue;
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "AssignmentStatus") {
						form.status = obj[0].FieldValue;
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityStartDate") {
						form.validFrom = new Date(obj[0].FieldValue);
					} else if (selectedTask[i].getCustomData('FieldName')[0].getValue() === "ValidityEndDate") {
						form.validTo = new Date(obj[0].FieldValue);
					}
				}
				if (formElements.length >= 1) {
					formContainers.push({
						form: $.extend(formElements, [], true)
					});
					formElements = [];
				}
			}

			form.containers = formContainers;
			oModel.setData(form);
			oModel1.setData(form);
			var oField = {
				fields: [],
				name: form.name,
				status: form.status,
				validFrom: form.validFrom,
				validTo: form.validTo

			};
			// form.formElements = formElements;
			oModel.setData(form);
			this.setGlobalModel(oModel, "EditedTask");
			this.createGroupingOfFields(formContainers, oField);

			this.setGlobalModel(new JSONModel(oField), "EditedTask1");
			this.setGlobalModel(new JSONModel(oField), "DisplayAssignmentDetails");
			this.setGlobalModel(new JSONModel(JSON.parse(JSON.stringify(oField))), "EditedTask2");
			var oTaskData = this.getModel("EditedTask2").getData();
			oTaskData.validTo = new Date(oTaskData.validTo);
			oTaskData.validFrom = new Date(oTaskData.validFrom);

			// this.oRouter.navTo("createAssignment", {}, false);
			oTable.setBusy(false);
			this.oRouter.navTo("editAssignment", {}, false);
			// }
		},
		onAssignmentWorklistPress: function (oEvent) {
			var that = this;
			var oCtx = oEvent.getSource().getBindingContext();
			// var obj = oEvent.getSource().getBindingContext().getObject();
			var data = this.getModel('WorklistFields').getData();
			var oControl = this.getModel("controls");
			var index = oEvent.getSource().getBindingContext("WorklistFields").getPath().split('/')[1];
			var oModel = new JSONModel();
			var data = this.getModel('ProfileFields').getData();
			var tasks = this.getModel('WorklistFields').getData();
			var formElements = [];
			var formContainers = [];
			var form = {
				name: null,
				status: false,
				containers: null
			};
			var oControl = this.getModel("controls");
			this.setGlobalModel(oControl, "controls");
			var selectedTask = oEvent.getSource().getAggregation('cells');
			var profileFields = $.extend(true, [], this.getModel('ProfileFields').getData());
			for (var i = 0; i < profileFields.length; i++) {
				if (profileFields[i].FieldName !== "AssignmentStatus") {
					if (tasks[index][profileFields[i].FieldName]) {
						profileFields[i].FieldValue = tasks[index][profileFields[i].FieldName];
					}
				}
				if (profileFields[i].FieldName !== "AssignmentName" && profileFields[i].FieldName !== "AssignmentStatus") {
					formElements.push(profileFields[i]);
				} else {
					if (profileFields[i].FieldName === "AssignmentName") {
						form.name = profileFields[i].FieldValue;
					} else {
						form.status = profileFields[i].FieldValue;
					}
				}
				if (formElements.length >= 1) {
					formContainers.push({
						form: $.extend(formElements, [], true)
					});
					formElements = [];
				}
			}
			form.containers = formContainers;
			var oField = {
				fields: [],
				name: null,
				status: false

			};
			// form.formElements = formElements;

			this.createGroupingOfFields(formContainers, oField);

			this.setGlobalModel(new JSONModel(oField), "EditedTask1");
			oModel.setData(form);
			// oModel.setData(data);
			oControl.setProperty('/createAssignment', false);
			oControl.setProperty('/editAssignment', false);
			oControl.setProperty('/displayAssignment', false);
			oControl.setProperty('/copyAssignment', false);
			oControl.setProperty('/importAssignment', true);
			oControl.setProperty('/assignmentTitle', this.oBundle.getText("displayAssignment"));
			this.setGlobalModel(oControl, "controls");
			this.setGlobalModel(oModel, "EditedTask");
			this.getRouter().navTo("editAssignment", {}, false);

		},
		onExit: function () {
			//Resetting On Behalf controls
			CommonModelManager.resetApplicationState("MYTIMESHEET");

			sap.ui.getCore().getMessageManager().removeAllMessages();
			// The personalization table must be destroyed by the app. If not, when the app is restarted another personalization
			// table is created with the same ID and thus the app can't be started.
			if (this.oTablePersoController) {
				this.oTablePersoController.destroy();
				delete this.oTablePersoController;
			}
			if (this.oTableTodoPersoController) {
				this.oTableTodoPersoController.destroy();
				delete this.oTableTodoPersoController;
			}
			if (this.oTableTaskPersoController) {
				this.oTableTaskPersoController.destroy();
				delete this.oTableTaskPersoController;
			}
		},
		recordTemplate: function () {
			var that = this;
			var recordTemplate = {
				AllowEdit: "",
				AllowRelease: "",
				AssignmentId: "",
				AssignmentName: "",
				CatsDocNo: "",
				Counter: "",
				Pernr: that.empID,
				RefCounter: "",
				RejReason: "",
				Status: "",
				SetDraft: false,
				target: "",
				TimeEntryDataFields: {
					AENAM: "",
					ALLDF: "",
					APDAT: null,
					APNAM: "",
					ARBID: "00000000",
					ARBPL: "",
					AUERU: "",
					AUFKZ: "",
					AUTYP: "00",
					AWART: "",
					BEGUZ: "000000",
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
					ENDUZ: "000000",
					ERNAM: "",
					ERSDA: null,
					ERSTM: null,
					ERUZU: "",
					EXTAPPLICATION: "",
					EXTDOCUMENTNO: "",
					EXTSYSTEM: "",
					FUNC_AREA: "",
					FUND: "",
					GRANT_NBR: "",
					HRBUDGET_PD: "",
					HRCOSTASG: "0",
					HRFUNC_AREA: "",
					HRFUND: "",
					HRGRANT_NBR: "",
					HRKOSTL: "",
					HRLSTAR: "",
					KAPAR: "",
					KAPID: "00000000",
					KOKRS: "",
					LAEDA: null,
					LAETM: null,
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
					PAOBJNR: "0000000000",
					PEDD: null,
					PERNR: "00000000",
					PLANS: "00000000",
					POSID: "",
					PRAKN: "",
					PRAKZ: "0000",
					PRICE: "0.0",
					RAPLZL: "00000000",
					RAUFNR: "",
					RAUFPL: "0000000000",
					REASON: "",
					REFCOUNTER: "000000000000",
					REINR: "0000000000",
					RKDAUF: "",
					RKDPOS: "000000",
					RKOSTL: "",
					RKSTR: "",
					RNPLNR: "",
					RPROJ: "00000000",
					RPRZNR: "",
					SBUDGET_PD: "",
					SEBELN: "",
					SEBELP: "00000",
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
					WORKDATE: "",
					WORKITEMID: "000000000000",
					WTART: ""
				},
				TimeEntryOperation: ""
			};
			return recordTemplate;
		},
		onEditTodoListMobile: function (oEvent) {
			var that = this;
			var index = oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1];
			var todolist = this.getModel('TodoList').getData();
			var oModel = new JSONModel(todolist[index]);
			this.setGlobalModel(oModel, "EditTodo");
			this.getRouter().navTo("editToDo", {}, false);
		},
		getFieldTexts: function (oFieldName) {
			var that = this;
			that.showBusy();
			var texts;
			var oModel = new sap.ui.model.json.JSONModel();
			var f = [];
			var c = new sap.ui.model.Filter({
				path: "Pernr",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.empID
			});
			var d = new sap.ui.model.Filter({
				path: "FieldName",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: oFieldName
			});
			var e = new sap.ui.model.Filter({
				path: "MaximumHits",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: "10000"
			});
			f.push(c);
			f.push(d);
			f.push(e);
			var mParameters = {
				urlParameters: '$expand=ValueHelpHits',
				filters: f,
				success: function (oData, oResponse) {
					texts = oData.results[0].ValueHelpHits.results;
					oModel.setData(texts);
					that.setModel(oModel, oFieldName);
					that.setGlobalModel(oModel, oFieldName);
					that.oTaskTable.bindItems({
						path: 'TaskFields>/',
						factory: that.dynamicBindingRows.bind(that)
					});
					that.hideBusy();
				},
				error: function (oError) {
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.read(that.appendLocaleParameter('/ValueHelpCollection'), mParameters);

		},
		getFieldText: function (oFieldName, key) {
			var that = this;
			return new Promise(function (fnResolve, fnReject) {
				// that.showBusy();
				var texts;
				var oModel = new sap.ui.model.json.JSONModel();
				var f = [];
				var c = new sap.ui.model.Filter({
					path: "Pernr",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: this.empID
				});
				var d = new sap.ui.model.Filter({
					path: "FieldName",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: oFieldName
				});
				var e = new sap.ui.model.Filter({
					path: "SelField1Name",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: oFieldName
				});
				var g = new sap.ui.model.Filter({
					path: "SelField1Val",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: key
				});
				if (key) {
					var h = new sap.ui.model.Filter({
						path: "FieldValue",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: key
					});
				}
				f.push(h);
				f.push(c);
				f.push(d);
				f.push(e);
				f.push(g);
				var mParameters = {
					urlParameters: '$expand=ValueHelpHits',
					filters: f,
					success: function (oData, oResponse) {
						var data = [];
						var texts;

						if (that.getModel(oFieldName)) {
							var data = that.getModel(oFieldName).getData();
							if (oData.results[0].ValueHelpHits.results.length > 0) {
								for (var i = 1; i < oData.results[0].ValueHelpHits.results.length; i++) {
									texts = oData.results[0].ValueHelpHits.results[i];
									data.push(texts);
								}
							}

						} else {
							if (oData.results[0].ValueHelpHits.results.length > 0) {
								for (var i = 1; i < oData.results[0].ValueHelpHits.results.length; i++) {
									texts = oData.results[0].ValueHelpHits.results[i];
									data.push(texts);
								}
							}
						}
						oModel.setData(data);
						that.setModel(oModel, oFieldName);
						that.setGlobalModel(oModel, oFieldName);
						that.oTaskTable.bindItems({
							path: 'TaskFields>/',
							factory: that.dynamicBindingRows.bind(that)
						});

						// that.hideBusy();

						fnResolve(oModel);
					},
					error: function (oError) {
						that.oErrorHandler.processError(oError);
					}
				};
				this.oDataModel.read(that.appendLocaleParameter('/ValueHelpCollection'), mParameters);
			}.bind(this));

		},
		startTimeChange: function (oEvent) {
			var that = this;
			var data = this.getModel("TimeData").getData();
			var index = oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1];
			data[index].TimeEntryDataFields.BEGUZ = that.formatter.convertTime(oEvent.getSource().getDateValue());
			// data[index].TimeEntryDataFields.ENDUZ = that.formatter.convertTime(oEvent.getSource().getDateValue());
			if (data[index].Counter !== "") {
				data[index].TimeEntryOperation = 'U';
			} else {
				data[index].TimeEntryOperation = 'C';
			}
			// var oModel = new JSONModel(data);
			// that.setModel(oModel, "TimeData");
			this.getModel("TimeData").refresh();
			if (this.checkButtonNeeded === "X") {
				this.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
				this.getModel("controls").setProperty("/isOverviewChanged", false);
				this.getModel("controls").setProperty("/overviewDataChanged", false);
			} else {
				this.getModel("controls").setProperty("/isOverviewChanged", true);
				this.getModel("controls").setProperty("/overviewDataChanged", true);
			}
			this.successfulCheck = "";
			sap.ushell.Container.setDirtyFlag(true);
			// var item = $.grep(this.oTable.getItems(), function (element, index) {
			// 	if (!element.getAggregation('cells')) {
			// 		return false;
			// 	} else {
			// 		return true;
			// 	}
			// });
			// item[index].focus();
		},
		endTimeChange: function (oEvent) {
			var that = this;
			var data = this.getModel("TimeData").getData();
			var oControl = this.getModel("controls");
			var index = oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1];
			data[index].TimeEntryDataFields.ENDUZ = that.formatter.convertTime(oEvent.getSource().getDateValue());
			if (data[index].Counter !== "") {
				data[index].TimeEntryOperation = 'U';
			} else {
				data[index].TimeEntryOperation = 'C';
			}

			this.getModel("TimeData").refresh();
			// var oModel = new JSONModel(data);
			// that.setModel(oModel, "TimeData");
			if (that.checkButtonNeeded === "X") {
				that.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
				that.getModel("controls").setProperty("/isOverviewChanged", false);
				that.getModel("controls").setProperty("/overviewDataChanged", false);
			} else {
				that.getModel("controls").setProperty("/isOverviewChanged", true);
				that.getModel("controls").setProperty("/overviewDataChanged", true);
			}
			this.successfulCheck = "";
			sap.ushell.Container.setDirtyFlag(true);
			// 

			// var item = $.grep(this.oTable.getItems(), function (element, index) {
			// 	if (!element.getAggregation('cells')) {
			// 		return false;
			// 	} else {
			// 		return true;
			// 	}
			// });
			// item[index].focus();
		},
		startTimeToDoChange: function (oEvent) {
			var that = this;
			var data = this.getModel("TodoList").getData();
			var index = oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1];
			data[index].TimeEntryDataFields.BEGUZ = that.formatter.convertTime(oEvent.getSource().getDateValue());
			if (data[index].Counter !== "") {
				data[index].TimeEntryOperation = 'U';
			} else {
				data[index].TimeEntryOperation = 'C';
			}
			this.getModel("TodoList").refresh();
			// var oModel = new JSONModel(data);
			// that.setModel(oModel, "TodoList");
			// var item = $.grep(this.oToDoTable.getItems(), function (element, index) {
			// 	if (!element.getAggregation('cells')) {
			// 		return false;
			// 	} else {
			// 		return true;
			// 	}
			// });
			// item[index].focus();
		},

		stopTimeToDoChange: function (oEvent) {
			var that = this;
			var data = this.getModel("TodoList").getData();
			var index = oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1];
			data[index].TimeEntryDataFields.ENDUZ = that.formatter.convertTime(oEvent.getSource().getDateValue());
			if (data[index].Counter !== "") {
				data[index].TimeEntryOperation = 'U';
			} else {
				data[index].TimeEntryOperation = 'C';
			}

			this.getModel("TodoList").refresh();
			// var oModel = new JSONModel(data);
			// that.setModel(oModel, "TodoList");
			// var item = $.grep(this.oToDoTable.getItems(), function (element, index) {
			// 	if (!element.getAggregation('cells')) {
			// 		return false;
			// 	} else {
			// 		return true;
			// 	}
			// });
			// item[index].focus();
		},
		onSelectionDraftToDo: function (oEvent) {
			var that = this;
			var oModel = this.oTable.getModel('TodoList');
			var index = parseInt(oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1]);
			var data = oModel.getData();
			var counter = oEvent.getSource().getParent().getCustomData('counter')[0].getValue();
			if (counter && counter !== null) {
				data[index].TimeEntryOperation = 'U';
			} else {
				data[index].TimeEntryOperation = 'C';
			}

			oModel.refresh();
			if (that.checkButtonNeeded === "X") {
				that.getModel("controls").setProperty("/todoDataChangedWithCheck", true);
				that.getModel("controls").setProperty("/isToDoChanged", false);
				that.getModel("controls").setProperty("/todoDataChanged", false);
			} else {
				that.getModel("controls").setProperty("/isToDoChanged", true);
				that.getModel("controls").setProperty("/todoDataChanged", true);
			}
			sap.ushell.Container.setDirtyFlag(true);
			that.successfulToDoCheck = "";
		},
		noAssignmentsDialog: function () {
			var that = this;
		},
		handleConfirmationDiscard: function (oEvent) {
			this._confirmationFunction();
		},
		showConfirmBox: function (oEvent, ok) {
			var that = this;
			var oDialogController = {
				handleClose: function (oEvent) {
					that._oDialog.destroy();
				},
				handleConfirmationDiscard: function (oEvent) {
					ok();
					that._oDialog.destroy();
				}
			};
			// if (!this._oDialog) {
			this._oDialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.CancelConfirmationPopOver",
				oDialogController);
			this.getView().addDependent(this._oDialog);
			// }
			this._oDialog.openBy(oEvent.getSource());
			// this._confirmationFunction = ok;
		},
		onCancelConfirm: function (oEvent) {
			var oControls = this.getModel("controls");
			if (oControls.getProperty("/isOverviewChanged") === true) {
				this.showConfirmBox(oEvent, this.onCancel.bind(this));
				oControls.setProperty("/isOverviewChanged", false);
			} else {
				this.onCancel();
				oControls.setProperty("/isOverviewChanged", false);
			}
			if (this.checkButtonNeeded === "X") {
				oControls.setProperty('/overviewDataChangedWithCheck', false);
			}
			oControls.setProperty('/overviewDataChanged', false);
			oControls.setProperty('/isOverviewChanged', false);
			sap.ushell.Container.setDirtyFlag(false);
			this.getEnteredHours(false);
			sap.ui.getCore().getMessageManager().removeAllMessages();

		},
		onTodoCancelConfirm: function (oEvent) {
			var oControls = this.getModel("controls");
			if (oControls.getProperty("/isToDoChanged") === true) {
				this.showConfirmBox(oEvent, this.onTodoCancel.bind(this));
				oControls.setProperty("/isToDoChanged", false);
			} else {
				this.onTodoCancel();
				oControls.setProperty("/isToDoChanged", false);
			}
			if (this.checkButtonNeeded === "X") {
				oControls.setProperty('/todoDataChangedWithCheck', false);
			}
			oControls.setProperty('/todoDataChanged', false);
			oControls.setProperty('/isToDoChanged', false);
			sap.ushell.Container.setDirtyFlag(false);
			sap.ui.getCore().getMessageManager().removeAllMessages();
		},
		onCreateGroup: function (oEvent) {
			var oSelectedItems = this.byId("idTasks").getSelectedContexts();
			var oAssignments = this.getModel("Tasks").getData();
			var group = {
				"groupId": null,
				"groupName": "",
				"count": 0,
				"Assignments": [],
			};
			this.byId("idTasks").setBusy(true);
			for (var i = 0; i < oSelectedItems.length; i++) {
				var index = oSelectedItems[i].sPath.split('/')[1];
				group.Assignments.push({
					"AssignmentId": oAssignments[index].AssignmentId,
					"AssignmentName": oAssignments[index].AssignmentName,
					"ValidityStartDate": oAssignments[index].ValidityStartDate,
					"ValidityEndDate": oAssignments[index].ValidityEndDate,
					"Rank": 1000 + i
				});
			}

			var oControls = this.getModel("controls");
			oControls.setProperty('/displayGroup', false);
			oControls.setProperty('/GroupCancel', true);
			oControls.setProperty('/createGroup', true);
			oControls.setProperty('/editGroup', false);
			//oControls.setProperty('/createGroupSave', false);
			if (group.Assignments.length > 0) {
				oControls.setProperty('/createGroupSave', true);
			} else {
				oControls.setProperty('/createGroupSave', false);
			}
			oControls.setProperty('/displayGroupCancel', false);
			oControls.setProperty('/GroupCancel', true);
			this.setGlobalModel(oControls, "controls");
			this.setGlobalModel(new JSONModel(group), "createGroup");
			var seqNumber = 1;
			//Sorting the data and assigning the seq number in order
			var sortedData =
				this.getGlobalModel("createGroup").getData().Assignments.sort(function (element1, element2) {

					if (element1.Rank <= element2.Rank) {
						return -1;
					}
					return 1;
					//Assign

				});

			sortedData.forEach(function (element1) {
				element1.Rank = seqNumber;
				seqNumber = seqNumber + 1;
			});
			this.byId("idTasks").setBusy(false);
			this.getRouter().navTo("createGroup", {}, false);
		},
		getAssignmentGroups: function () {
			this.oTaskTable.setBusy(true);
			var that = this;
			// var oModel = new sap.ui.model.json.JSONModel();
			// var TaskModel = new sap.ui.model.json.JSONModel();
			// var oControl;
			// var obj;
			// var TaskFields = [];
			// var task = {};
			var a = new sap.ui.model.Filter({
				path: "Pernr",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: this.empID
			});
			var f = [];
			f.push(a);

			var mParameters = {
				filters: f,
				urlParameters: '$expand=ToGrps',
				success: function (oData, oResponse) {
					that.tasks = oData.results;
				},
				error: function (oError) {
					that.oTaskTable.setBusy(false);
					that.oErrorHandler.processError(oError);
				}
			};
			this.oDataModel.read(that.appendLocaleParameter('/AssignmentCollection'), mParameters);

		},
		onDisplayGroup: function (oEvent) {
			var that = this;
			var oControls = this.getModel("controls");
			oControls.setProperty('/displayGroup', true);
			oControls.setProperty('/createGroup', false);
			oControls.setProperty('/createGroupSave', true);
			oControls.setProperty('/editGroup', false);
			oControls.setProperty('/displayGroupCancel', false);
			oControls.setProperty('/GroupCancel', false);
			this.setGlobalModel(oControls, "controls");
			var Assignments = this.getModel('AssignmentGroups').getData();
			var index = parseInt(oEvent.getSource().getBindingContext('AssignmentGroups').getPath().split('/')[1]);
			this.setGlobalModel(new JSONModel(Assignments[index]), "createGroup");
			var seqNumber = 1;
			var sortedData =
				this.getGlobalModel("createGroup").getData().Assignments.sort(function (element1, element2) {

					if (element1.Rank <= element2.Rank) {
						return -1;
					}
					return 1;
					//Assign

				});

			sortedData.forEach(function (element1) {
				element1.Rank = seqNumber;
				seqNumber = seqNumber + 1;
			});
			this.getRouter().navTo("createGroup", {}, false);

		},
		onEditGroup: function (oEvent) {
			var that = this;
			var oControls = this.getModel("controls");
			oControls.setProperty('/displayGroup', false);
			oControls.setProperty('/editGroup', true);
			oControls.setProperty('/displayGroupCancel', false);
			oControls.setProperty('/GroupCancel', true);
			this.setGlobalModel(oControls, "controls");
			var Assignments = this.getModel('AssignmentGroups').getData();
			var index = parseInt(this.byId('idGroups').getSelectedItem().getBindingContext('AssignmentGroups').getPath().split("/")[1]);
			this.setGlobalModel(new JSONModel(Assignments[index]), "createGroup");
			this.getRouter().navTo("createGroup", {}, false);
		},
		handleDateChange: function (oEvent) {
			var that = this;
			var oDialogController = {
				handleConfirm: function (oEvent) {
					that.filterDateFrom = oDateRange.getDateValue();
					that.filterDateTo = oDateRange.getSecondDateValue();
					if (that.filterDateFrom == null && that.filterDateTo == null) {
						if (oDialog) {
							oDialog.destroy();
						}
					} else {
						//Avoiding time zone conversion errors
						that.filterDateFrom = new Date(Date.UTC(that.filterDateFrom.getFullYear(), that.filterDateFrom.getMonth(), that.filterDateFrom
							.getDate(), that.filterDateFrom.getHours()));
						that.filterDateTo = new Date(Date.UTC(that.filterDateTo.getFullYear(), that.filterDateTo.getMonth(), that.filterDateTo.getDate(),
							that.filterDateTo.getHours()));
						that.getTasks(false, that.filterDateFrom, that.filterDateTo, true);
						that.filterAppliedFlag = "X";
						that.getView().byId("filterGroupAssignment").setType(sap.m.ButtonType.Emphasized);
					}
					if (oDialog) {
						oDialog.destroy();
					}
				},
				handleCancel: function (oEvent) {
					if (oDialog) {
						oDialog.destroy();
					}
				},
				handleResetFilters: function (oEvent) {
					that.filterDateFrom = "";
					that.filterDateTo = "";
					that.getView().byId("filterGroupAssignment").setType(sap.m.ButtonType.Transparent);
					if (oDialog && that.filterAppliedFlag == "X") {
						that.filterAppliedFlag = "";
						that.getTasks(false, that.minNavDate, that.maxNavDate);
						that.getView().byId("filterGroupAssignment").setType(sap.m.ButtonType.Transparent);
						oDialog.destroy();
					}
				}
			};

			var oDialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.FilterAssignment",
				oDialogController);
			// Set initial and reset value for Slider in custom control
			var oDateRange = oDialog.getFilterItems()[0].getCustomControl();
			this.getView().addDependent(oDialog);
			// toggle compact style
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oDialog);
			oDialog.open();

		},
		// group delete confirmation added
		//Note 2890326 Starts
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
		//Note 2890326 Ends
		onGroupSelection: function (oEvent) {
			var oControl = this.getModel("controls");
			var oSelectedItems = oEvent.getParameter("selectedContexts");
			if (oEvent.getParameters().listItem.getSelected() === true && this.byId("idGroups").getSelectedItems().length == 1) {
				oControl.setProperty("/EditGroup", true);
				oControl.setProperty("/DeleteGroup", true);
				oControl.setProperty("/createGroupButton", true);
			} else if (this.oTaskTable.getSelectedItems().length == 1) {
				oControl.setProperty("/EditGroup", true);
				oControl.setProperty("/DeleteGroup", true);
				oControl.setProperty("/createGroupButton", true);
			} else {
				oControl.setProperty("/EditGroup", false);
				if (this.byId("idGroups").getSelectedItems().length === 0) {
					oControl.setProperty("/DeleteGroup", false);
				} else {
					oControl.setProperty("/DeleteGroup", true);
				}
				oControl.setProperty("/createGroupButton", true);
			}
		},
		onGroupDelete: function (oEvent) {
			var that = this;
			var oGroupData = [];
			var oDelGroup = this.getModel('AssignmentGroups').getData();
			var oSelectedItems = this.byId('idGroups').getSelectedItems();
			for (var k = 0; k < oSelectedItems.length; k++) {
				var index = parseInt(oSelectedItems[k].getBindingContext('AssignmentGroups').getPath().split("/")[1]);
				if (oDelGroup[index].Assignments) {
					for (var i = 0; i < oDelGroup[index].Assignments.length; i++) {
						var data = {
							GrpId: oDelGroup[index].groupId,
							GrpName: oDelGroup[index].groupName,
							AssignmentId: oDelGroup[index].Assignments[i].AssignmentId,
							GrpOperation: 'D'
						};
						oGroupData.push(data);
					}
				}
			}
			this.SubmitGroup(oGroupData);
			// this.setGlobalModel(new JSONModel(Assignments[index]), "createGroup");
			// this.getRouter().navTo("createGroup", {}, false);
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
							oModel.createEntry(
								that.appendLocaleParameter("/AssignmentGrpsSet"),
								obj);
						}
						oModel.submitChanges({
							groupId: "TimeGroup",
							changeSetId: "TimeGroup",
							success: function (oData, res) {
								var length = oData.__batchResponses[0].__changeResponses.length;
								if (oData.__batchResponses[0].__changeResponses[0].data.GrpName === oData.__batchResponses[0].__changeResponses[length -
										1]
									.data.GrpName) {
									var toastMsg = that.oBundle.getText("deleteGroupAssignment");
								} else {
									var toastMsg = that.oBundle.getText("deleteGroupsAssignment");
								}
								//var toastMsg = that.oBundle.getText("deleteGroupAssignment");
								sap.m.MessageToast.show(toastMsg, {
									duration: 3000
								});
								that.getTasks(false, that.minNavDate, that.maxNavDate);
							},
							error: function (oError) {
								that.oErrorHandler.processError(oError);
							}
						});

					}, true);
		},
		handleSearchAssignments: function (oEvent) {
			var that = this;
			var oFilter = [];
			var search = oEvent.getSource().getValue();
			if (search !== "") {
				oFilter.push(new Filter("AssignmentName", FilterOperator.Contains, search));
				var oRef = this.byId('idTasks').getBinding('items').filter(oFilter);
				if (this.byId('idTasks').getItems().length === 0) {
					this.byId('idTasks').setNoDataText(this.oBundle.getText("assignmentNoData"));
				}
			} else {
				// oFilter.push(new Filter("AssignmentName", FilterOperator.Contains, search));
				var oRef = this.byId('idTasks').getBinding('items').filter(oFilter);
				this.byId('idTasks').setNoDataText(this.oBundle.getText("overviewMessageStrip"));
			}
		},
		handleSearchGroups: function (oEvent) {
			var that = this;
			var oFilter = [];
			var search = oEvent.getSource().getValue();
			if (search !== "") {
				oFilter.push(new Filter("groupName", FilterOperator.Contains, search));
				var oRef = this.byId('idGroups').getBinding('items').filter(oFilter);
				if (this.byId('idGroups').getItems().length === 0) {
					this.byId('idGroups').setNoDataText(this.oBundle.getText("assignmentNoData"));
				}
			} else {
				var oRef = this.byId('idGroups').getBinding('items').filter(oFilter);
				this.byId('idGroups').setNoDataText(this.oBundle.getText("overviewMessageStrip"));

			}
		},
		navigateToTasks: function () {
			// this.byId("idIconTabBarNoIcons").setSelectedKey("tasks");
			var that = this;
			var oControl = this.getModel("controls");
			var messageHeader = that.oBundle.getText("confirmationSwitchTab");
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			if ((oControl.getProperty("/isOverviewChanged") || oControl.getProperty("/overviewDataChanged") || oControl.getProperty(
					"/overviewDataChangedWithCheck") === true)) {
				sap.m.MessageBox.warning(
					that.oBundle.getText("confirmationSwitchTabGeneral"), {
						title: that.oBundle.getText("confirm"),
						actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
						styleClass: bCompact ? "sapUiSizeCompact" : "",
						onClose: function (sAction) {
							if (sAction === "CANCEL") {
								// that.byId("ObjectPageLayout").setSelectedSection("application-MyTimesheet-display-component---worklist--tasks");
								that.byId("ObjectPageLayout").setSelectedSection(that.byId("ObjectPageLayout").getSections()[0].getId());
								return;
							} else {
								that.onCancel();
								sap.ui.getCore().getMessageManager().removeAllMessages();
								that.iconTabSelectionProcessing(that.byId("ObjectPageLayout").getSections()[2].getId());
								that.byId("ObjectPageLayout").setSelectedSection(that.byId("ObjectPageLayout").getSections()[2].getId());
							}
						}
					}

				);
			} else if (!(oControl.getProperty("/isOverviewChanged") || oControl.getProperty("/overviewDataChanged") || oControl.getProperty(
					"/overviewDataChangedWithCheck") === true)) {
				that.onCancel();
				if (oControl.getProperty("/isToDoChanged") || oControl.getProperty("/todoDataChanged") || oControl.getProperty(
						"/todoDataChangedWithCheck") === true) {
					oControl.setProperty("/showFooter", true);
				}
				// this.iconTabSelectionProcessing(oEvent.getParameter('section').getId().split("worklist--")[1]);
				that.iconTabSelectionProcessing(that.byId("ObjectPageLayout").getSections()[2].getId());
				this.byId("ObjectPageLayout").setSelectedSection(this.byId("ObjectPageLayout").getSections()[2].getId());
			}

		},
		onShowOverviewMessage: function (oEvent) {
			var that = this;
			var oControl = this.getModel("controls");
			oControl.setProperty("/showOverviewMessage", true);
		},
		onCloseOverviewMessage: function (oEvent) {
			var that = this;
			var oControl = this.getModel("controls");
			oControl.setProperty("/showOverviewMessage", false);
		},
		onShowAssignmentsMessage: function (oEvent) {
			var that = this;
			var oControl = this.getModel("controls");
			oControl.setProperty("/showAssignmentsMessage", true);
		},
		onCloseAssignmentsMessage: function (oEvent) {
			var that = this;
			var oControl = this.getModel("controls");
			oControl.setProperty("/showAssignmentsMessage", false);
		},
		onShowGroupMessage: function (oEvent) {
			var that = this;
			var oControl = this.getModel("controls");
			oControl.setProperty("/showGroupMessage", true);
		},
		onCloseGroupMessage: function (oEvent) {
			var that = this;
			var oControl = this.getModel("controls");
			oControl.setProperty("/showGroupMessage", false);
		},
		resizeWindow: function (oEvent) {
			if (oEvent.width <= 1536) {
				this.byId("idCalendar").setWidth();
			} else {
				this.byId("idCalendar").setWidth("100%");
			}
		},
		onProjectDetails: function (oEvent) {
			var that = this;
			this.showBusy();
			var index = oEvent.getSource().getBindingContext('TimeData').getPath().split('/')[1];
			var timeData = that.getModel("TimeData").getData()[index];
			that.getProjectDetails(that.empID, timeData.TimeEntryDataFields.CPR_GUID, timeData.TimeEntryDataFields.CPR_OBJGUID);
			// create popover
			var that = this;
			var oDialogController = {
				handleClose: function (event) {
					oDialog.close();
					oDialog.destroy();
				},
				handleBeforeOpen: function (oEvent) {
					var timeData = that.getModel("TimeData").getData()[index];
					that.getProjectDetails(that.empID, timeData.TimeEntryDataFields.CPR_GUID, timeData.TimeEntryDataFields.CPR_OBJGUID);
				}
			};
			var oDialog;
			if (!oDialog) {
				// create dialog via fragment factory
				oDialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.ProjectDetails", oDialogController);
				// oDialog.bindElement('TimeDataDuplicateTask>/0');
				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(oDialog);
			}
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oDialog);

			jQuery.sap.delayedCall(0, this, function () {
				oDialog.open();
			});
			this.hideBusy();
		},
		onReadOnlyProjectDetails: function (oEvent) {
			var that = this;
			var index = oEvent.getSource().getBindingContext('TimeData').getPath().split('/')[1];
			var timeData = that.getModel("TimeData").getData()[index];
			// new Promise(function (fnResolve, fnReject) {
			that.getProjectDetails(that.empID, timeData.TimeEntryDataFields.CPR_GUID, timeData.TimeEntryDataFields.CPR_OBJGUID);
			// 	fnResolve(that.readOnlyProject.bind(this));
			// 	fnReject();
			// });

			// this.hideBusy();
		},
		readOnlyProject: function () {
			var that = this;
			// create popover
			var oDialogController = {
				handleClose: function (event) {
					that.hideBusy();
					oDialog.close();
					oDialog.destroy();
				},
				handleBeforeOpen: function (oEvent) {

				}
			};
			var oDialog;
			if (!oDialog) {
				// create dialog via fragment factory
				oDialog = sap.ui.xmlfragment(this.getView().getId(), "hcm.fab.mytimesheet.view.fragments.ReadOnlyProjectDetails",
					oDialogController);
				this.getView().addDependent(oDialog);
			}
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oDialog);

			jQuery.sap.delayedCall(0, this, function () {
				oDialog.open();
			});
		},
		onPreviousDayIndicator: function (oEvent) {
			var that = this;
			var oModel = this.oTable.getModel('TimeData');
			var index = parseInt(oEvent.getSource().getParent().getBindingContext('TimeData').getPath().split('/')[1]);
			var data = oModel.getData();
			var selectedBox = oEvent.getSource().getSelected();
			if (selectedBox) {
				data[index].TimeEntryDataFields.VTKEN = 'X';
			} else {
				data[index].TimeEntryDataFields.VTKEN = null;
			}
			var counter = oEvent.getSource().getParent().getCustomData('counter')[0].getValue();
			if (counter && counter !== null) {
				data[index].TimeEntryOperation = 'U';
			} else {
				data[index].TimeEntryOperation = 'C';
			}
			var oModel = new JSONModel(data);
			this.setFocusFixedElement();
			that.setModel(oModel, "TimeData");

			if (that.checkButtonNeeded === "X") {
				that.getModel("controls").setProperty("/overviewDataChangedWithCheck", true);
				that.getModel("controls").setProperty("/isOverviewChanged", false);
				that.getModel("controls").setProperty("/overviewDataChanged", false);
			} else {
				that.getModel("controls").setProperty("/isOverviewChanged", true);
				that.getModel("controls").setProperty("/overviewDataChanged", true);
			}
			sap.ushell.Container.setDirtyFlag(true);
		},
		onToDoPreviousDayIndicator: function (oEvent) {
			var that = this;
			var oModel = this.oTable.getModel('TodoList');
			var index = parseInt(oEvent.getSource().getParent().getBindingContext('TodoList').getPath().split('/')[1]);
			var data = oModel.getData();
			var selectedBox = oEvent.getSource().getSelected();
			if (selectedBox) {
				data[index].TimeEntryDataFields.VTKEN = 'X';
			} else {
				data[index].TimeEntryDataFields.VTKEN = null;
			}
			var counter = oEvent.getSource().getParent().getCustomData('counter')[0].getValue();
			if (counter && counter !== null) {
				data[index].TimeEntryOperation = 'U';
			} else {
				data[index].TimeEntryOperation = 'C';
			}
			var oModel = new JSONModel(data);
			this.setFocusFixedElement();
			that.setModel(oModel, "TodoList");

			this.getModel("controls").setProperty("/isOverviewChanged", true);
			this.getModel("controls").setProperty("/overviewDataChanged", true);
			sap.ushell.Container.setDirtyFlag(true);
		},
		getProjectDetails: function (oPernr, oProjectGuid, oTaskGuid) {
			var that = this;
			this.showBusy();
			var mParameters = {
				success: function (oData, oResponse) {
					that.hideBusy(true);
					var data = oData;
					that.setModel(new JSONModel(data), "ProjectDetails");
					that.readOnlyProject();

				},
				error: function (oError) {
					that.hideBusy();
					that.hideBusy(true);
					that.oErrorHandler.processError(oError);

				}
			};
			this.oDataModel.read("/ProjectDetailsSet(Pernr='" + oPernr + "',ProjectGuid='" + oProjectGuid + "',TaskGuid='" + oTaskGuid +
				"')",
				mParameters);

		},
		renderTexts: function () {
			var that = this;
			that.fieldTextFetchedAsync = {};
			var checkObj = {};
			for (var i = 0; i < this.renderFieldTexts.length; i++) {
				if (!checkObj[this.renderFieldTexts[i].key + '*!*' + this.renderFieldTexts[i].value]) {
					checkObj[this.renderFieldTexts[i].key + '*!*' + this.renderFieldTexts[i].value] = 1;
				} else {
					this.renderFieldTexts.splice(i, 1);
					i--;
				}

			}
			for (var i = 0; i < this.renderFieldTexts.length; i++) {

				this.getFieldTextAsync(this.renderFieldTexts[i].key, this.renderFieldTexts[i].value);
			}
		},

		handleOverviewFilterButtonPressed: function (oEvent) {
			if (!this._oDialogFil) {
				this._oDialogFil = sap.ui.xmlfragment(this.getView().getId(),
					"hcm.fab.mytimesheet.view.fragments.OverviewFilterPopOver",
					this);
				this.getView().addDependent(this._oDialogFil);
			}
			var that = this;

			var oSelectedKey = that.getView().byId("filterCombo").getSelectedKey();
			that.setModel(new JSONModel(oSelectedKey), 'lastSelectedKey');

			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._oDialogFil);
			this._oDialogFil.open();

		},
		resetFilter: function () {
			var that = this;
			that.byId("combo").setSelectedKey("100");
			that.byId("filterCombo").setSelectedKey("100");
			that.onStatusChangeFilter("100");
		},

		handleOverviewSortingButtonPressed: function (oEvent) {
			if (!this._oDialogInd) {
				this._oDialogInd = sap.ui.xmlfragment(this.getView().getId(),
					"hcm.fab.mytimesheet.view.fragments.OverviewSortPopOver",
					this);
				this.getView().addDependent(this._oDialogInd);
			}
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._oDialogInd);
			this._oDialogInd.open();
		},
		handleOverviewSortingConfirm: function (oEvent) {
			var that = this;
			var mParams = oEvent.getParameters();
			var oView = this.getView();
			this.sortKey = mParams.sortItem.getKey();
			this.sortDecendingOrder = mParams.sortDescending;
			that.bindTable(new Date(that.startdate), new Date(that.enddate));
			this.rebindTableWithTemplate(this.oTable, "TimeData>/", this.oReadOnlyTemplate, "Navigation");
			var filterKey = that.getView().byId("filterCombo").getSelectedKey();
			that.onStatusChangeAfterSort(filterKey);
			return true;
		},
		handleFilterConfirm: function (oEvent) {
			var that = this;
			try {
				that.byId("filterCombo").setSelectedKey(that.getView().byId("combo").getSelectedKey());
				that.onStatusChangeFilter(that.getView().byId("combo").getSelectedKey());
			} catch (e) {
				that.byId("filterCombo").setSelectedKey("100");
				that.onStatusChangeFilter("100");
			}
		},

		handleFilterCancel: function (oEvent) {
			// var that = this;
			// try {
			// 	that.byId("filterCombo").setSelectedKey(that.getModel('lastSelectedKey').getData());
			// 	that.onStatusChangeFilter(that.getModel('lastSelectedKey').getData());

			// } catch (e) {
			// 	that.byId("filterCombo").setSelectedKey("100");
			// 	that.onStatusChangeFilter("100");
			// }
		},
		getFieldTextAsync: function (oFieldName, key) {
			var that = this; //

			return new Promise(function (fnResolve, fnReject) {
				var texts;
				var oModel = new sap.ui.model.json.JSONModel();
				var f = [];
				var c = new sap.ui.model.Filter({
					path: "Pernr",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: this.empID
				});
				var d = new sap.ui.model.Filter({
					path: "FieldName",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: oFieldName
				});
				var e = new sap.ui.model.Filter({
					path: "SelField1Name",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: oFieldName
				});
				var g = new sap.ui.model.Filter({
					path: "SelField1Val",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: key
				});
				if (key) {
					var h = new sap.ui.model.Filter({
						path: "FieldValue",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: key
					});
				}
				f.push(h);
				f.push(c);
				f.push(d);
				f.push(e);
				f.push(g);
				var mParameters = {
					urlParameters: '$expand=ValueHelpHits',
					filters: f,
					success: function (oData, oResponse) {
						var data = [];
						var texts;
						if (that.getModel(oFieldName)) {
							var data = that.getModel(oFieldName).getData();
							if (oData.results[0].ValueHelpHits.results.length > 0) {
								for (var i = 1; i < oData.results[0].ValueHelpHits.results.length; i++) {
									texts = oData.results[0].ValueHelpHits.results[i];
									data.push(texts);
								}
							}

						} else {
							if (oData.results[0].ValueHelpHits.results.length > 0) {
								for (var i = 1; i < oData.results[0].ValueHelpHits.results.length; i++) {
									texts = oData.results[0].ValueHelpHits.results[i];
									data.push(texts);
								}
							}
						}
						oModel.setData(data);
						that.setModel(oModel, oFieldName);
						that.setGlobalModel(oModel, oFieldName);
						that.oTaskTable.bindItems({
							path: 'TaskFields>/',
							factory: that.dynamicBindingRows.bind(that)
						});

						fnResolve(oModel);
					},
					error: function (oError) {
						that.oErrorHandler.processError(oError);
					}
				};
				this.oDataModel.read(that.appendLocaleParameter('/ValueHelpCollection'), mParameters);
			}.bind(this));

		}

	});
});