/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/lib/common/controls/ConcurrentEmploymentOverflowToolbarButton",
	"hcm/fab/lib/common/util/CommonModelManager",
	"hcm/fab/lib/common/util/DateUtil",
	"hcm/fab/lib/common/util/TeamCalendarDataManager",
	"sap/m/Button",
	"sap/m/Dialog",
	"sap/m/HBox",
	"sap/m/Image",
	"sap/m/Label",
	"sap/m/MessageStrip",
	"sap/m/ObjectIdentifier",
	"sap/m/OverflowToolbar",
	"sap/m/OverflowToolbarButton",
	"sap/m/OverflowToolbarLayoutData",
	"sap/m/OverflowToolbarPriority",
	"sap/m/Panel",
	"sap/m/PlacementType",
	"sap/m/PlanningCalendar",
	"sap/m/PlanningCalendarRow",
	"sap/m/PlanningCalendarView",
	"sap/m/ResponsivePopover",
	"sap/m/SearchField",
	"sap/m/SegmentedButton",
	"sap/m/SegmentedButtonItem",
	"sap/m/Select",
	"sap/m/Text",
	"sap/m/ToolbarSpacer",
	"sap/m/VBox",
	"sap/ui/core/Control",
	"sap/ui/core/InvisibleText",
	"sap/ui/core/Item",
	"sap/ui/Device",
	"sap/ui/layout/form/SimpleForm",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/json/JSONModel",
	"sap/ui/unified/CalendarAppointment",
	"sap/ui/unified/CalendarLegend",
	"sap/ui/unified/CalendarLegendItem",
	"sap/ui/unified/DateTypeRange"
], function(
	ConcurrentEmploymentOverflowToolbarButton,
	CommonModelManager,
	DateUtil,
	TeamCalendarDataManager,
	Button,
	Dialog,
	HBox,
	Image,
	Label,
	MessageStrip,
	ObjectIdentifier,
	OverflowToolbar,
	OverflowToolbarButton,
	OverflowToolbarLayoutData,
	OverflowToolbarPriority,
	Panel,
	PlacementType,
	PlanningCalendar,
	PlanningCalendarRow,
	PlanningCalendarView,
	ResponsivePopover,
	SearchField,
	SegmentedButton,
	SegmentedButtonItem,
	Select,
	Text,
	ToolbarSpacer,
	VBox,
	Control,
	InvisibleText,
	Item,
	Device,
	SimpleForm,
	Filter,
	FilterOperator,
	JSONModel,
	CalendarAppointment,
	CalendarLegend,
	CalendarLegendItem,
	DateTypeRange
) {
	"use strict";

	var TeamCalendarControl = Control.extend("hcm.fab.lib.common.controls.TeamCalendarControl", {
		metadata: {
			library: "hcm.fab.lib.common",
			properties: {
				applicationId: {
					type: "string"
				},
				instanceId: {
					type: "string",
					defaultValue: ""
				},
				assignmentId: {
					type: "string"
				},
				requesterId: {
					type: "string"
				},
				startDate: {
					type: "object"
				},
				leaveRequestStartDate: {
					type: "object"
				},
				leaveRequestEndDate: {
					type: "object"
				},
				leaveRequestDescription: {
					type: "string"
				},
				leaveRequestMode: {
					type: "boolean",
					defaultValue: false
				},
				leaveRequestSimulateRequest: {
					type: "boolean",
					defaultValue: false
				},
				showSearchField: {
					type: "boolean",
					defaultValue: true
				},
				showFilterBox: {
					type: "boolean",
					defaultValue: true
				},
				showConcurrentEmploymentButton: {
					type: "boolean",
					defaultValue: true
				},
				showLegendButton: {
					type: "boolean",
					defaultValue: true
				},
				showViewSelector: {
					type: "boolean",
					defaultValue: true
				},
				dataChangedDate: {
					type: "object"
				}
			},
			events: {
				dataRequesting: {},
				dataChanged: {
					parameters: {
						employeeList: {
							type: "object[]"
						},
						employeeConflictList: {
							type: "object[]"
						}
					}
				}
			},
			aggregations: {
				_calendar: {
					type: "sap.m.PlanningCalendar",
					multiple: false,
					visibility: "hidden"
				},
				_toolbar: {
					type: "sap.m.OverflowToolbar",
					multiple: false,
					visibility: "hidden"
				},
				_filterInfo: {
					type: "sap.m.MessageStrip",
					multiple: false,
					visibility: "hidden"
				},
				_legendDialog: {
					type: "sap.m.Dialog",
					multiple: false,
					visibility: "hidden"
				},
				_eventDetailsPopover: {
					type: "sap.m.ResponsivePopover",
					multiple: false,
					visibility: "hidden"
				}
			}
		},

		init: function() {
			if (Control.prototype.init) {
				Control.prototype.init.apply(this, arguments);
			}

			// private property initializations
			this._oDataManager = null;
			this._oDataChangedDate = undefined;
			this._bFlushEmployees = false;

			// Get resource file for library
			this.setModel(CommonModelManager.getI18NModel(), "libI18N");
			this._oResourceBundle = CommonModelManager.getI18NModel().getResourceBundle();


			// Only allow initial loading of data if default assignment is unknown
			var oPromiseAssignmentHelper = {};
			oPromiseAssignmentHelper.promise = new Promise(function(resolve, reject) {
				oPromiseAssignmentHelper.resolve = resolve;
				oPromiseAssignmentHelper.reject = reject;
			});
			this._oPromiseAssignmentHelper = oPromiseAssignmentHelper;

			// Do initializations
			var applicationId = this.getApplicationId();
			var instanceId = this.getInstanceId();
			this._oDataManager = new TeamCalendarDataManager(applicationId, instanceId);
			this._oDataManager.attachUiSettingsChanged(this.onUISettingsChange.bind(this));
			this._oDataManager.attachViewListChanged(this.onViewListChange.bind(this));

			// Pass settings to datamanager that might already be set
			this._oDataManager.setAssignmentId(this.getAssignmentId());
			this._oDataManager.setRequesterId(this.getRequesterId());

			this.setModel(CommonModelManager.getModel(), "commonModel");

			// Initialize calendar model
			this._oLocalModel = new JSONModel({
				startDate: null,
				employeeList: [],
				employeeCount: 0,
				employeeCountAfterFilter: 0,
				viewList: [],
				selectedView: {},
				selectedViewKey: null,
				activeFilterKey: null,
				activeSearchQuery: "",
				isRequestingData: true,
				assignmentId: "",
				legendItems: [],
				eventDetailView: {},
				uiSettings: {},
				assignmentInfo: {},
				leaveRequestMode: false,
				leaveRequestStartDate: null,
				leaveRequestEndDate: null,
				showSearchField: true,
				showFilterBox: true,
				showConcurrentEmploymentButton: true,
				showLegendButton: true,
				showViewSelector: true
			});
			this._oLocalModel.setSizeLimit(1000);
			this.setModel(this._oLocalModel, "CalendarModel");

			// Build team calendar UI components
			var aToolbarContent = [
				new InvisibleText({
					id: this.createId("toolbarViewChangeLabel"),
					text: "{libI18N>teamcalendarViewChangeLabel}"
				}),
				new SegmentedButton({
					id: this.createId("toolbarViewChangeButton"),
					select: this.onTabChange.bind(this),
					visible: "{CalendarModel>/showViewSelector}",
					//enabled: "{= ${CalendarModel>/viewList}.length > 1 }",
					selectedKey: "{CalendarModel>/selectedViewKey}",
					ariaLabelledBy: this.createId("toolbarViewChangeLabel"),
					items: {
						path: "CalendarModel>/viewList",
						templateShareable: false,
						template: new SegmentedButtonItem({
							text: "{CalendarModel>Description}",
							key: "{CalendarModel>ApplicationId}*{CalendarModel>InstanceId}*{CalendarModel>ViewType}*{CalendarModel>ViewId}"
						}),
						layoutData: new OverflowToolbarLayoutData({
							priority: OverflowToolbarPriority.Low,
							group: 1
						})
					}
				}),
				new OverflowToolbarButton({
					id: this.createId("toolbarAddViewButton"),
					text: "{libI18N>personalizationAddViewButtonText}",
					tooltip: "{libI18N>personalizationAddViewButtonTooltip}",
					icon: "sap-icon://add",
					visible: "{= ${CalendarModel>/uiSettings/personalizationMode} === 'FULL' && ${CalendarModel>/showViewSelector} }",
					press: this.onAddViewPressed.bind(this),
					layoutData: new OverflowToolbarLayoutData({
						priority: OverflowToolbarPriority.Low,
						group: 1
					})
				}),
				new ToolbarSpacer({
					id: this.createId("toolbarSpacer")
				}),
				new SearchField({
					id: this.createId("toolbarSearchField"),
					search: this.onSearch.bind(this),
					visible: "{= ${CalendarModel>/showSearchField} && ${CalendarModel>/uiSettings/showSearch} }",
					layoutData: Device.system.desktop ?
						new OverflowToolbarLayoutData({
							priority: OverflowToolbarPriority.NeverOverflow,
							maxWidth: "224px"
						}) :
						new OverflowToolbarLayoutData({
							priority: OverflowToolbarPriority.NeverOverflow,
							shrinkable: true,
							minWidth: "224px",
							maxWidth: "352px"
						})
				}),
				new InvisibleText({
					id: this.createId("toolbarFilterSelectLabel"),
					text: "{libI18N>teamcalendarFilterLabel}"
				}),
				new Select({
					id: this.createId("toolbarFilterSelect"),
					change: this.onFilterChange.bind(this),
					selectedKey: "{CalendarModel>/activeFilterKey}",
					visible: "{= ${CalendarModel>/showFilterBox} && ${CalendarModel>/uiSettings/showFilter} && !${CalendarModel>/leaveRequestMode} }",
					ariaLabelledBy: this.createId("toolbarFilterSelectLabel"),
					items: [
						new Item({
							key: "ALL",
							text: "{libI18N>filterTextEmployeeAll}"
						}),
						new Item({
							key: "ABSENT",
							text: "{libI18N>filterTextEmployeeAbsent}"
						}),
						new Item({
							key: "AVAILABLE",
							text: "{libI18N>filterTextEmployeeAvailable}"
						})
					],
					layoutData: new OverflowToolbarLayoutData({
						priority: OverflowToolbarPriority.Low
					})
				}),
				new OverflowToolbarButton({
					id: this.createId("toolbarLegendButton"),
					text: "{libI18N>legendOpenButtonText}",
					tooltip: "{libI18N>legendOpenButtonTooltip}",
					icon: "sap-icon://legend",
					visible: "{= ${CalendarModel>/showLegendButton} && ${CalendarModel>/uiSettings/showLegend} }",
					press: this.onLegendButtonPress.bind(this),
					layoutData: new OverflowToolbarLayoutData({
						priority: OverflowToolbarPriority.Low
					})
				}),
				new OverflowToolbarButton({
					id: this.createId("personalizationButton"),
					text: "{libI18N>personalizationOpenButtonText}",
					tooltip: "{libI18N>personalizationOpenButtonTooltip}",
					icon: "sap-icon://user-settings",
					visible: "{= ${CalendarModel>/uiSettings/personalizationMode} !== 'NONE' && ${CalendarModel>/selectedView/PersonalizationMode} !== 'NONE' }",
					press: this.onPersonalizationButtonPress.bind(this),
					layoutData: new OverflowToolbarLayoutData({
						priority: OverflowToolbarPriority.Low
					})
				}),
				new ConcurrentEmploymentOverflowToolbarButton({
					id: this.createId("toolbarConcurrentEmploymentButton"),
					applicationId: "{CalendarModel>/applicationId}",
					assignmentId: "{CalendarModel>/assignmentId}",
					assignmentChange: this.onAssignmentChanged.bind(this),
					visible: "{= ${CalendarModel>/showConcurrentEmploymentButton} && ${CalendarModel>/uiSettings/showCeButton} }",
					layoutData: new OverflowToolbarLayoutData({
						priority: OverflowToolbarPriority.Low
					})
				})
			];

			var oCalendarLegendItemTemplateProperties = {
				type: "{CalendarModel>EventType}",
				text: "{CalendarModel>Description}"
			};
			//SAPUI5 1.46: Allow to set a specific color, overwriting the color derived from the property "type"
			if(CalendarLegendItem.getMetadata().hasProperty("color")) {
				oCalendarLegendItemTemplateProperties.color = "{CalendarModel>Color}";
			}
			var oLegend = new CalendarLegend({
				id: this.createId("calendarInplaceLegend"),
				items: {
					path: "CalendarModel>/legendItems",
					templateShareable: false,
					template: new CalendarLegendItem(oCalendarLegendItemTemplateProperties)
				}
			});
			
			
			// Build properties for appointment template based on SAPUI5 version
			var oAppointmentTemplateProperties = {
				startDate: "{CalendarModel>StartDate}",
				endDate: "{CalendarModel>EndDate}",
				type: "{CalendarModel>EventType}",
				title: "{CalendarModel>Title}",
				text: "{CalendarModel>Description}",
				tooltip: "{= ${CalendarModel>Tooltip} || ${CalendarModel>Title} }",
				icon: "{CalendarModel>ToEventType/Icon}",
				tentative: "{CalendarModel>IsTentative}"
			};
			//SAPUI5 1.46: Allow to set a specific color, overwriting the color derived from the property "type"
			if(CalendarAppointment.getMetadata().hasProperty("color")) {
				oAppointmentTemplateProperties.color = "{CalendarModel>ToEventType/Color}";
			}
			
			var oPlanningCalendarRowProperties = {
				title: "{CalendarModel>Name}",
				text: "{CalendarModel>Description}",
				tooltip: "{= ${CalendarModel>Tooltip} || ${CalendarModel>Name} }",
				icon: {
					formatter: this.formatEmployeePhotoUrl,
					parts: ["CalendarModel>ImageURL", "CalendarModel>/uiSettings/showEmployeePhoto", "CalendarModel>/assignmentInfo/ShowEmployeePicture"]
				},
				selected: false,
				key: "{CalendarModel>EmployeeId}",
				appointments: {
					path: "CalendarModel>ToTeamCalendarEvent",
					templateShareable: false,
					template: new CalendarAppointment(oAppointmentTemplateProperties)
				}
			};
			
			//SAPUI5 1.56: NonWorking days can be set per date
			if(PlanningCalendarRow.getMetadata().hasAggregation("specialDates")) {
				oPlanningCalendarRowProperties.nonWorkingDays = [];
				oPlanningCalendarRowProperties.specialDates = {
					path: "CalendarModel>NonWorkingDates",
					templateShareable: false,
					template: new DateTypeRange({
						startDate: "{CalendarModel>}",
						type: sap.ui.unified.CalendarDayType.NonWorking 
					})
				};
			} else {
				oPlanningCalendarRowProperties.nonWorkingDays = "{CalendarModel>NonWorkingDays}";
			}
			
			// Build properties for planning calendar based on SAPUI5 version
			var oPlanningCalendarProperties = {
				id: this.createId("planningCalendarControl"),
				busy: "{CalendarModel>/isRequestingData}",
				busyIndicatorDelay: 200,
				startDate: "{CalendarModel>/startDate}",
				startDateChange: this.onCalendarStartDateChange.bind(this),
				showIntervalHeaders: false,
				appointmentsReducedHeight: true,
				appointmentsVisualization: "Filled",
				appointmentSelect: this.onEventClick.bind(this),
				rowSelectionChange: this.onRowSelectionChanged.bind(this),
				viewChange: this.onViewChanged.bind(this),
				views: [],
				rows: {
					path: "CalendarModel>/employeeList",
					templateShareable: false,
					template: new PlanningCalendarRow(oPlanningCalendarRowProperties)
				},
				legend: oLegend
			};
			
			//SAPUI5 1.54: Sticky header property (only enable it in 1.56 were it works reliable)
			if(PlanningCalendar.getMetadata().hasProperty("stickyHeader") && PlanningCalendarRow.getMetadata().hasAggregation("specialDates")) {
				oPlanningCalendarProperties.stickyHeader = true;
			}

			//SAPUI5 1.52: showWeekNumbers
			if(PlanningCalendar.getMetadata().hasProperty("showWeekNumbers")) {
				oPlanningCalendarProperties.showWeekNumbers = true;
			}

			//SAPUI5 1.50: Only use built-in views for week and month views
			if(PlanningCalendar.getMetadata().hasProperty("builtInViews")) {
				oPlanningCalendarProperties.viewKey = sap.m.PlanningCalendarBuiltInView.Week;
				//SAPUI5 1.56: specialDates aggregation available -> enable month view
				if(Device.system.desktop && PlanningCalendarRow.getMetadata().hasAggregation("specialDates")) {
					//On Desktop: Show Week (Month view not yet supported because of non-working days)
					oPlanningCalendarProperties.builtInViews = [
						sap.m.PlanningCalendarBuiltInView.Week,
						sap.m.PlanningCalendarBuiltInView.OneMonth
					];
				} else {
					//On Mobile: Only show Week view
					oPlanningCalendarProperties.builtInViews = [sap.m.PlanningCalendarBuiltInView.Week];
				}
			} else {
				oPlanningCalendarProperties.viewKey = "Week";
				oPlanningCalendarProperties.views.push(
					new PlanningCalendarView({
						id: this.createId("oneWeekView"),
						key: "Week",
						intervalType: sap.ui.unified.CalendarIntervalType.Day,
						description: "{libI18N>viewDescriptionWeek}",
						intervalsS: 7,
						intervalsM: 7,
						intervalsL: 7
					})
				);
			}
			
			var oCalendar = new PlanningCalendar(oPlanningCalendarProperties)
				.addStyleClass("sapMPlanCalSuppressAlternatingRowColors")
				.addStyleClass("sapUiTinyMargin");
				
			// SAPUI5 1.50: Exposes the showDayNamesLine property in the PlanningCalendaar
			if(PlanningCalendar.getMetadata().hasProperty("showDayNamesLine")) {
				oCalendar.setShowDayNamesLine(true);
			}
			this.setAggregation("_calendar", oCalendar);

			// Toolbar above calendar
			var oToolbar = new OverflowToolbar({
				id: this.createId("calendarToolbar"),
				content: aToolbarContent
			}).addStyleClass("sapUiTinyMargin");
			this.setAggregation("_toolbar", oToolbar);

			var oMessageStrip = new MessageStrip({
				id: this.createId("calendarActiveFilterInfo"),
				visible: "{= ${CalendarModel>/employeeCount} !== ${CalendarModel>/employeeCountAfterFilter} }",
				showIcon: true,
				showCloseButton: true,
				text: {
					formatter: this.formatInfoBarLabelText.bind(this),
					parts: [
						"CalendarModel>/activeFilterKey",
						"CalendarModel>/activeSearchQuery",
						"CalendarModel>/employeeCount",
						"CalendarModel>/employeeCountAfterFilter",
						"CalendarModel>/leaveRequestMode",
						"CalendarModel>/leaveRequestStartDate",
						"CalendarModel>/leaveRequestEndDate"
					]
				},
				close: function() {
				}
			});
			oMessageStrip.addStyleClass("sapUiTinyMargin");
			this.setAggregation("_filterInfo", oMessageStrip);

			// Create legend dialog
			var oLegendDialog = new sap.m.Dialog({
				id: this.createId("legendDialog"),
				title: "{libI18N>legendDialogTitle}",
				content: oLegend,
				ariaDescribedBy: oLegend,
				endButton: new Button({
					id: this.createId("legendDialogCancelButton"),
					text: "{libI18N>legendCancelButtonText}",
					tooltip: "{libI18N>legendCancelButtonTooltip}",
					press: function() {
						this.getAggregation("_legendDialog").close();
					}.bind(this)
				})
			});
			this.setAggregation("_legendDialog", oLegendDialog);
			
			this._oEventDetailsForm = new SimpleForm({
				id: this.createId("eventDetailContentForm")
			});
			var oPopover = new ResponsivePopover({
				id: this.createId("eventDetailPopover"),
				placement: PlacementType.Auto,
				modal: true,
				title: "{libI18N>eventDetailViewTitle}",
				contentWidth: "20rem",
				beginButton: new Button({
					id: this.createId("eventDetailCloseButton"),
					text: "{libI18N>eventDetailCloseButtonText}",
					tooltip: "{libI18N>eventDetailCloseButtonTooltip}",
					press: this.onEventDetailClosePressed.bind(this)
				}),
				content: [
					new VBox({
						id: this.createId("eventDetailVerticalLayout"),
						renderType: "Bare",
						items: [
							new HBox({
								id: this.createId("eventDetailTitleHorizontalLayout"),
								renderType: "Bare",
								alignItems: "Center",
								items: [
									new Image({
										id: this.createId("eventDetailTitleEmployeePhoto"),
										src: {
											formatter: this.formatEmployeePhotoUrl,
											parts: ["CalendarModel>/eventDetailView/EmployeePicture", "CalendarModel>/uiSettings/showEmployeePhoto", "CalendarModel>/assignmentInfo/ShowEmployeePicture"]
										},
										width: "3rem",
										height: "3rem",
										alt: "{CalendarModel>/eventDetailView/EmployeeName}",
										decorative: false,
										densityAware: false,
										visible: "{= ${CalendarModel>/uiSettings/showEmployeePhoto} && ${CalendarModel>/assignmentInfo/ShowEmployeePicture} }"
									}).addStyleClass("sapUiTinyMargin"),
									new ObjectIdentifier({
										id: this.createId("eventDetailTitleEmployeeIdentifier"),
										title: "{CalendarModel>/eventDetailView/EmployeeName}",
										text: "{CalendarModel>/eventDetailView/EmployeeDescription}"
									}).addStyleClass("sapUiTinyMargin")
								]
							}).addStyleClass("sapUiTinyMargin"),
							new Panel({
								id: this.createId("eventDetailDetailPanel"),
								headerText: "{libI18N>eventDetailViewGroupTitle}",
								content: [
									this._oEventDetailsForm
								]
							})
						]
					})
				]
			});
			this.setAggregation("_eventDetailsPopover", oPopover);
		},
		
		exit: function() {
			if (Control.prototype.exit) {
				Control.prototype.exit.apply(this, arguments);
			}
			if(this._queuedReadRequest) {
				jQuery.sap.clearDelayedCall(this._queuedReadRequest);
			}
		},

		renderer: function(oRM, oControl) {
			oRM.write("<div");
			oRM.writeControlData(oControl);
			oRM.writeClasses();
			oRM.write(">");

			oRM.renderControl(oControl.getAggregation("_toolbar"));
			oRM.renderControl(oControl.getAggregation("_filterInfo"));
			oRM.renderControl(oControl.getAggregation("_calendar"));

			oRM.write("</div>");
		},

		onAfterRendering: function() {
			// Show "Mon 2, Tue 3" in two lines
			// SAPUI5 1.50: Exposes the showDayNamesLine property in the PlanningCalendaar
			if(!PlanningCalendar.getMetadata().hasProperty("showDayNamesLine")) {
				var oDateInt = sap.ui.getCore().byId(this.createId("planningCalendarControl-DateInt"));
				if (oDateInt) {
					oDateInt.setShowDayNamesLine(true);
				}
			}
			
			// Hide view select element if there is only one view to select from
			// SAPUI5 <1.50: Only manually hide view select control if we not use built-in-views
			if(!PlanningCalendar.getMetadata().hasProperty("builtInViews")) {
				var oIntType = sap.ui.getCore().byId(this.createId("planningCalendarControl-IntType"));
				if (oIntType) {
					oIntType.setVisible(false);
				}
			}
		},

		getAccessibilityInfo: function() {
			return this.getAggregation("_calendar").getAccessibilityInfo();
		},

		createId: function(sId) {
			return this.getId() + "-" + sId;
		},
		
		invalidateCalendarData: function() {
			// Invalidate the event buffer and reload the events for the currently displayed interval
			if(this._oDataManager) {
				this._oDataManager.refreshBuffer(false, true);
				this._queueReadRequest();
			}
		},

		onAssignmentChanged: function(oEvent) {
			this.setAssignmentId(oEvent.getParameter("selectedAssignment"));

			this._queueReadRequest();
		},

		onEventClick: function(oControlEvent) {
			// Get source controls in calendar
			var oSourceEvent = oControlEvent.getParameter("appointment");
			var oEvent = this._oLocalModel.getProperty(oSourceEvent.getBindingContext("CalendarModel").getPath());
			var oEmployee = this._oLocalModel.getProperty(oSourceEvent.getParent().getBindingContext("CalendarModel").getPath());

			// Deselect appointment
			oSourceEvent.setSelected(false);

			// Update local data for detail quickview
			this._oLocalModel.setProperty("/eventDetailView", {
				EmployeeName: oEmployee.Name,
				EmployeeDescription: oEmployee.Description,
				EmployeePicture: oEmployee.ImageURL
			});
			
			// aria description
			var oPopup = this.getAggregation("_eventDetailsPopover");
			oPopup.removeAllAriaDescribedBy();
			oPopup.addAriaDescribedBy(this.createId("eventDetailTitleEmployeeIdentifier"));
			oPopup.addAriaDescribedBy(this.createId("eventDetailDetailPanel"));
			
			// Update form content
			this._oEventDetailsForm.destroyContent();
			oEvent.getEventDetailFieldList().forEach(function(oField, index) {
				this._oEventDetailsForm.addContent(new Label({
					id: this.createId("eventDetailLabel-" + index),
					text: oField.label,
					labelFor: this.createId("eventDetailText-" + index)
				}));
				this._oEventDetailsForm.addContent(new Text({
					id: this.createId("eventDetailText-" + index),
					text: oField.value
				}));
				oPopup.addAriaDescribedBy(this.createId("eventDetailLabel-" + index));
				oPopup.addAriaDescribedBy(this.createId("eventDetailText-" + index));
			}.bind(this));
			

			// Open quickview on the clicked event
			var oAppointment = oControlEvent.getParameter("appointment");
			oPopup.openBy(oAppointment);
		},
		
		onRowSelectionChanged: function(oEvent) {
			oEvent.getParameter("rows").forEach(function(oRow) {
				oRow.setSelected(false);
			});
		},
		
		onViewChanged: function(oEvent) {
			this._bFlushEmployees = true;
		},
		
		onEventDetailClosePressed: function() {
			this.getAggregation("_eventDetailsPopover").close();
		},

		onTabChange: function() {
			var sKey = this._oLocalModel.getProperty("/selectedViewKey");

			// Change displayed view in data manager
			this._changeView(this._convertViewKeyToViewObject(sKey));
		},

		_convertViewObjectToViewKey: function(oView) {
			return oView.ApplicationId + "*" + oView.InstanceId + "*" + oView.ViewType + "*" + oView.ViewId;
		},

		onSearch: function(oEvent) {
			this._oLocalModel.setProperty("/activeSearchQuery", oEvent.getParameter("query"));
			this.onFilterChange();
		},

		onFilterChange: function() {
			var aFilter = [];

			// Search string
			var searchString = this._oLocalModel.getProperty("/activeSearchQuery");
			if (searchString) {
				aFilter.push(new Filter("", function(oEmployee) {
					return this._filterFunctionSearchString(searchString, oEmployee);
				}.bind(this)));
			}

			// In leaverequest mode only apply special filter
			if (this.getProperty("leaveRequestMode")) {
				aFilter.push(new Filter([
					new Filter("", this._filterFunctionIsSelf),
					new Filter("ToLeaveRequestEvent", this._filterFunctionAbsent)
				], false));
			} else {
				// Filter box
				var filterKey = this._oLocalModel.getProperty("/activeFilterKey");
				if (filterKey && filterKey !== "ALL") {
					if (filterKey === "ABSENT") {
						aFilter.push(new Filter("ToTeamCalendarEvent", this._filterFunctionAbsent));
					}
					if (filterKey === "AVAILABLE") {
						aFilter.push(new Filter("ToTeamCalendarEvent", this._filterFunctionAvailable));
					}
				}
			}

			this.getAggregation("_calendar").getBinding("rows").filter(new Filter(aFilter, true), "Application");
			
			// Active filters -> set info bar to visible
			this.updateFilteInfoBindings();
		},
		
		_filterFunctionSearchString: function(sSearchString, oEmployee) {
			var sSearchStringLower = sSearchString.toLowerCase();
			if(oEmployee.Name && oEmployee.Name.toLowerCase().indexOf(sSearchStringLower) !== -1) {
				return true;
			}
			if(oEmployee.Description && oEmployee.Description.toLowerCase().indexOf(sSearchStringLower) !== -1) {
				return true;
			}
			if(oEmployee.ToTeamCalendarEvent) {
				var fnSome = function(oEvent) {
					return oEvent.Title.toLowerCase().indexOf(sSearchStringLower) !== -1
							|| oEvent.Description.toLowerCase().indexOf(sSearchStringLower) !== -1;
				};
				if(oEmployee.ToTeamCalendarEvent.some(fnSome)) {
					return true;
				}
			}
			return false;
		},

		_filterFunctionAbsent: function(aTimeEvents) {
			return aTimeEvents.some(function(oEvent) {
				return oEvent.ToEventType.IsRelevantForAbsence;
			});
		},

		_filterFunctionAvailable: function(aTimeEvents) {
			return aTimeEvents.every(function(oEvent) {
				return !oEvent.ToEventType.IsRelevantForAbsence;
			});
		},

		_filterFunctionIsSelf: function(oEmployee) {
			// Check if the person is the requesting person. In this case, keep person in the result
			return oEmployee.RequesterId === oEmployee.EmployeeId || oEmployee.EmployeeAssignment === oEmployee.EmployeeId;
		},

		_convertViewKeyToViewObject: function(sKey) {
			var sParts = sKey.split("*");
			return {
				ApplicationId: sParts[0],
				InstanceId: sParts[1],
				ViewType: sParts[2],
				ViewId: sParts[3]
			};
		},

		_changeView: function(oView, bNoDataRequest) {
			// Make sure UI reflects the selected view correctly
			var sViewKey = this._convertViewObjectToViewKey(oView);
			this._oLocalModel.setProperty("/selectedViewKey", sViewKey);

			// Change the view for subsequent requests
			this._oDataManager.setView(oView);
			this._oLocalModel.setProperty("/selectedView", this._oDataManager.getDisplayedView());

			// Generate legend for calendar and popup
			this._updateLegendItems();

			// Read the calendar data for the new view
			if (!bNoDataRequest) {
				this._queueReadRequest();
			}
		},

		_updateLegendItems: function() {
			// Update legend items in model
			this._oLocalModel.setProperty("/legendItems", this._oDataManager.getEventTypesForCurrentView().filter(
				function(oEventType) {
					return !oEventType.ShowAsNonWorkingDay;
				}
			));
		},

		onLegendButtonPress: function() {
			this.getAggregation("_legendDialog").open();
		},

		onAddViewPressed: function() {
			if (!this._oPersonalizationController) {
				this._oPersonalizationController = sap.ui.controller("hcm.fab.lib.common.controller.TeamCalendarViewPersonalization");
				this._oPersonalizationController.attachDialogClosed(this.onPersonalizationDialogClosed.bind(this));
				this._oPersonalizationController.onInit();
			}
			this._oPersonalizationController.openDialog(this, this._oDataManager.getEmployeeList(true), this._oDataManager.getDisplayedView(),
				this._oDataManager.getViewList(), "addViewPage");
		},

		onPersonalizationButtonPress: function() {
			if (!this._oPersonalizationController) {
				this._oPersonalizationController = sap.ui.controller("hcm.fab.lib.common.controller.TeamCalendarViewPersonalization");
				this._oPersonalizationController.attachDialogClosed(this.onPersonalizationDialogClosed.bind(this));
				this._oPersonalizationController.onInit();
			}
			this._oPersonalizationController.openDialog(this, this._oDataManager.getEmployeeList(true), this._oDataManager.getDisplayedView(),
				this._oDataManager.getViewList(), "employeePage");
		},

		onPersonalizationDialogClosed: function(oEvent) {
			switch (oEvent.getParameter("action")) {
				case "EMPLOYEES_CHANGED":
					this._oDataManager.refreshBuffer(false, true);
					this._queueReadRequest();
					break;
				case "VIEW_ADDED":
				case "VIEW_CHANGED":
					this._oDataManager.refreshBuffer(true, true);
					this._oDataManager.setView(oEvent.getParameter("view"));
					this._queueReadRequest();
					break;
				case "VIEW_DELETED":
					this._oDataManager.refreshBuffer(true, true);
					//this._oDataManager.setView(oEvent.getParameter("view"));
					this._queueReadRequest();
					break;
			}
		},

		onCalendarStartDateChange: function() {
			// Request data
			this._queueReadRequest();
		},

		_calculateCalendarEndDate: function(startDate) {
			var endDate = new Date(startDate.getTime());
			endDate.setDate(endDate.getDate() + this._getCurrentViewDimension() - 1);
			return endDate;
		},

		_readCalendarData: function() {
			// Check that a startDate was already externally set
			if (!this.getProperty("startDate")) {
				return;
			}
			var startDate = this.getAggregation("_calendar").getStartDate();
			//var startDate = DateUtil.convertToFullDayUTC(this.getAggregation("_calendar").getStartDate());

			// If in leaverequest mode, then both start and end date need to be set
			if (this.getProperty("leaveRequestMode") &&
				!(this.getProperty("leaveRequestStartDate") &&
					this.getProperty("leaveRequestEndDate") &&
					this.getProperty("requesterId"))) {
				return;
			}

			// Calculate correct endDate according to current displayed range in calendar
			var endDate = this._calculateCalendarEndDate(startDate);
			
			// Remember date when requsted started, since the data returned will *at least* be from this time (or newer)
			this._oDataChangedDate = new Date(); 
			
			// Trigger requests
			this._oLocalModel.setProperty("/isRequestingData", true);
			this.fireDataRequesting();

			var oAssignmentPromise = this._oPromiseAssignmentHelper.promise;
			var oDataPromise = this._oDataManager.getCalendarData(startDate, endDate);
			Promise.all([oDataPromise, oAssignmentPromise]).then(
				function(oData) {
					// Update internal structures
					var aEmployeeList = oData[0];
					if(this._bFlushEmployees) {
						this._oLocalModel.setProperty("/employeeList", []);
						this._bFlushEmployees = false;
					}
					this._oLocalModel.setProperty("/employeeList", aEmployeeList);
					this._oLocalModel.setProperty("/employeeCount", aEmployeeList.length);
					this._oLocalModel.setProperty("/isRequestingData", false);
					
					// Filters might be set, update the info bar
					this.updateFilteInfoBindings();
					
					// Fire data changed event
					this._fireDataChangedEvent(aEmployeeList);
				}.bind(this),
				function(oError) {
					if (oError.reason && oError.reason === this._oDataManager.REASON_OUTDATED_CALL) {
						return; // Do not remove busy indicator, since other calls might still be pending (they will remove busy)
					}
					this._oLocalModel.setProperty("/isRequestingData", false);
				}.bind(this)
			);
		},

		_fireDataChangedEvent: function(aEmployeeList) {
			if (this.getProperty("leaveRequestMode") && this.getProperty("leaveRequestStartDate") && this.getProperty("leaveRequestEndDate")) {
				this.fireDataChanged({
					employeeList: aEmployeeList.filter(
						function(oEmployee) {
							return this._filterFunctionIsSelf(oEmployee) || this._filterFunctionAbsent(oEmployee.ToLeaveRequestEvent);
						}.bind(this)
					),
					employeeConflictList: aEmployeeList.filter(
						function(oEmployee) {
							return !this._filterFunctionIsSelf(oEmployee) && this._filterFunctionAbsent(oEmployee.ToLeaveRequestEvent);
						}.bind(this)
					)
				});
			} else {
				this.fireDataChanged({
					employeeList: aEmployeeList,
					employeeConflictList: []
				});
			}
		},

		_getCurrentViewDimension: function() {
			var key = this.getAggregation("_calendar").getViewKey();
			return key === "Week" ? 7 : 31;
		},

		setStartDate: function(startDate) {
			if (startDate === undefined || startDate === null) {
				return;
			}

			// Round startDate according to current view
			var _startDate = DateUtil.convertToFullDayLocal(startDate);
			var oOldStartDate = this.getProperty("startDate");
			if (!oOldStartDate || oOldStartDate.getTime() !== _startDate.getTime()) {
				this.setProperty("startDate", _startDate, true);

				// Pass start date to calendar
				this._oLocalModel.setProperty("/startDate", _startDate);

				// reload data, if date changed
				this._queueReadRequest();
			}
		},

		setAssignmentId: function(assignmentId) {
			if (assignmentId === undefined) {
				return;
			}

			this.setProperty("assignmentId", assignmentId, true);

			// update internal JSON model
			this._oLocalModel.setProperty("/assignmentId", assignmentId);

			// pass to data manager
			var bRefresh = this._oDataManager.setAssignmentId(assignmentId);
			if (bRefresh) {
				this._queueReadRequest();
			}
			
			// fetch additional assignment information
			CommonModelManager.getAssignmentInformation(assignmentId, this.getApplicationId()).then(function(oAssignment) {
				this._oLocalModel.setProperty("/assignmentInfo", oAssignment);
			}.bind(this));

			// resolve assignment promise, if this is the first assignment change
			if (this._oPromiseAssignmentHelper.resolve) {
				this._oPromiseAssignmentHelper.resolve();
				this._oPromiseAssignmentHelper.resolve = null;
			}
		},

		setRequesterId: function(requesterId) {
			if (requesterId === undefined) {
				return;
			}

			this.setProperty("requesterId", requesterId, true);

			// pass to data manager
			var bRefresh = this._oDataManager.setRequesterId(requesterId);
			if (bRefresh) {
				this._queueReadRequest();
			}
		},

		setApplicationId: function(applicationId) {
			this._oLocalModel.setProperty("/applicationId", applicationId);
			this.setProperty("applicationId", applicationId, true);
			this._oDataManager.setApplicationId(applicationId);
		},

		setInstanceId: function(instanceId) {
			this.setProperty("instanceId", instanceId, true);
			this._oDataManager.setInstanceId(instanceId);
		},

		setLeaveRequestMode: function(leaveRequestMode) {
			this.setProperty("leaveRequestMode", leaveRequestMode, true);
			this._oLocalModel.setProperty("/leaveRequestMode", leaveRequestMode);
			this._oDataManager.setLeaveRequestMode(leaveRequestMode);
			this._queueReadRequest();

			// Update corresponding filter
			this.onFilterChange();
		},

		setLeaveRequestSimulateRequest: function(leaveRequestSimulateRequest) {
			this.setProperty("leaveRequestSimulateRequest", leaveRequestSimulateRequest, true);
			this._oDataManager.setLeaveRequestSimulateRequest(leaveRequestSimulateRequest);
		},

		setLeaveRequestDescription: function(leaveRequestDescription) {
			this.setProperty("leaveRequestDescription", leaveRequestDescription, true);
			this._oDataManager.setLeaveRequestDescription(leaveRequestDescription);
		},

		setLeaveRequestStartDate: function(leaveRequestStartDate) {
			// Date is assumed in local time, convert to UTC
			var _leaveRequestStartDate = DateUtil.convertToFullDayUTC(leaveRequestStartDate);

			this.setProperty("leaveRequestStartDate", _leaveRequestStartDate, true);
			this._oLocalModel.setProperty("/leaveRequestStartDate", _leaveRequestStartDate);
			this._oDataManager.setLeaveRequestStartDate(_leaveRequestStartDate);
			this._queueReadRequest();

			// Update corresponding filter
			this.onFilterChange();
		},

		setLeaveRequestEndDate: function(leaveRequestEndDate) {
			// Date assumed in usertime, convert to UTC
			var _leaveRequestEndDate = DateUtil.convertToFullDayUTC(leaveRequestEndDate);
			if (_leaveRequestEndDate) {
				_leaveRequestEndDate.setUTCHours(23);
				_leaveRequestEndDate.setUTCMinutes(59);
			}

			this.setProperty("leaveRequestEndDate", _leaveRequestEndDate, true);
			this._oLocalModel.setProperty("/leaveRequestEndDate", _leaveRequestEndDate);
			this._oDataManager.setLeaveRequestEndDate(_leaveRequestEndDate);
			this._queueReadRequest();

			// Update corresponding filter
			this.onFilterChange();
		},

		setShowSearchField: function(bValue) {
			this.setProperty("showSearchField", bValue, true);
			this._oLocalModel.setProperty("/showSearchField", bValue);
		},

		setShowFilterBox: function(bValue) {
			this.setProperty("showFilterBox", bValue, true);
			this._oLocalModel.setProperty("/showFilterBox", bValue);
		},

		setShowConcurrentEmploymentButton: function(bValue) {
			this.setProperty("showConcurrentEmploymentButton", bValue, true);
			this._oLocalModel.setProperty("/showConcurrentEmploymentButton", bValue);
		},

		setShowLegendButton: function(bValue) {
			this.setProperty("showLegendButton", bValue, true);
			this._oLocalModel.setProperty("/showLegendButton", bValue);
		},

		setShowViewSelector: function(bValue) {
			this.setProperty("showViewSelector", bValue, true);
			this._oLocalModel.setProperty("/showViewSelector", bValue);
		},
		
		setDataChangedDate: function(oDate) {
			// No valid value given or no data yet read, no need to change the buffer
			if(!oDate) {
				return;
			}
			this.setProperty("dataChangedDate", oDate, true);
			
			// Given date is newer then the time from the last request?
			if(this._oDataChangedDate) { // at least one time read?
				if(this._oDataChangedDate.getTime() <= oDate.getTime()) {
					this.invalidateCalendarData();
				}
			}

		},

		_queueReadRequest: function() {
			if (this._queuedReadRequest) {
				jQuery.sap.clearDelayedCall(this._queuedReadRequest);
			}
			this._queuedReadRequest = jQuery.sap.delayedCall(0, this, "_readCalendarData");
		},

		onUISettingsChange: function(oEvent) {
			var oUISettings = oEvent.getParameter("uiSettings");
			this._oLocalModel.setProperty("/activeFilterKey", oUISettings.DefaultFilterMode);
			this._oLocalModel.setProperty("/uiSettings/showCeButton", oUISettings.ShowCeButton);
			this._oLocalModel.setProperty("/uiSettings/showLegend", oUISettings.ShowLegend);
			this._oLocalModel.setProperty("/uiSettings/personalizationMode", oUISettings.PersonalizationMode);
			this._oLocalModel.setProperty("/uiSettings/showEmployeePhoto", oUISettings.ShowEmployeePhoto);
			this._oLocalModel.setProperty("/uiSettings/showFilter", oUISettings.ShowFilter);
			this._oLocalModel.setProperty("/uiSettings/showSearch", oUISettings.ShowSearch);
			
			//refresh filter settings
			this.onFilterChange();
		},

		onViewListChange: function(oEvent) {
			var viewList = oEvent.getParameter("viewList");
			this._oLocalModel.setProperty("/viewList", viewList);

			// Display the default view
			var oDisplayedView = oEvent.getParameter("selectedView");
			this._changeView(oDisplayedView, true); // Data will be set separately (not request it her, since internal buffers are not yet completely set)
		},
		
		updateFilteInfoBindings: function() {
			var afterFilter = this.getAggregation("_calendar").getBinding("rows").getLength();
			this._oLocalModel.setProperty("/employeeCountAfterFilter", afterFilter);
		},

		formatEmployeePhotoUrl: function(sPhotoUrl, bShowPhoto, bAssignmentShowPhoto) {
			if (bShowPhoto && bAssignmentShowPhoto) {
				return sPhotoUrl;
			} else {
				return undefined;
			}
		},
		
		formatInfoBarLabelText: function(sActiveFilterKey, sSearchQuery, iEmployeeCount, iEmployeeCountAfterFilter, bLeaveRequestMode, oLeaveRequestStartDate, oLeaveRequestEndDate) {
			// Not all employees filtered? First message parameter is the employee count
			var bFilter = false;
			var bSearch = false;
			var aParameters = [];
			if(iEmployeeCountAfterFilter > 0) {
				aParameters.push(iEmployeeCount - iEmployeeCountAfterFilter);
			}
			
			// Determine which filter is
			switch(sActiveFilterKey) {
				case "ABSENT":
					aParameters.push(this._oResourceBundle.getText("filterTextEmployeeAbsent"));
					bFilter = true;
					break;
				case "AVAILABLE":
					aParameters.push(this._oResourceBundle.getText("filterTextEmployeeAvailable"));
					bFilter = true;
					break;
			}
			
			// Is a search active?
			if(sSearchQuery !== "") {
				aParameters.push(sSearchQuery);
				bSearch = true;
			}
			
			
			// In leave request mode show a static text
			if(bLeaveRequestMode) {
				if(!oLeaveRequestStartDate || !oLeaveRequestEndDate) {
					return undefined;
				}
				var oStartDate = DateUtil.convertToLocal(oLeaveRequestStartDate);
				var oEndDate = DateUtil.convertToLocal(oLeaveRequestEndDate);
				var sDate = DateUtil.formatDateRange(oStartDate, oEndDate);
				if(DateUtil.isSameDay(oStartDate, oEndDate)) {
					return this._oResourceBundle.getText("activeFilterInfoBarLabelTextOverlapModeSingleDay", [sDate]);
				} else {
					return this._oResourceBundle.getText("activeFilterInfoBarLabelTextOverlapModePeriod", [sDate]);
				}
			}
			
			
			// Determine the correct message for the employee/filter count
			if(iEmployeeCountAfterFilter === 0) { // All employees
				if(bFilter && !bSearch) {
					return this._oResourceBundle.getText("activeFilterInfoBarLabelTextAllEmployeeFilter", aParameters);
				}
				if(!bFilter && bSearch) {
					return this._oResourceBundle.getText("activeFilterInfoBarLabelTextAllEmployeeSearch", aParameters);
				}
				if(bFilter && bSearch) {
					return this._oResourceBundle.getText("activeFilterInfoBarLabelTextAllEmployeeFilterAndSearch", aParameters);
				}
			} else {
				// One or multiple employees
				var diffEmployee = iEmployeeCount - iEmployeeCountAfterFilter;
				if(diffEmployee === 1) {
					if(bFilter && !bSearch) {
						return this._oResourceBundle.getText("activeFilterInfoBarLabelText1EmployeeFilter", aParameters);
					}
					if(!bFilter && bSearch) {
						return this._oResourceBundle.getText("activeFilterInfoBarLabelText1EmployeeSearch", aParameters);
					}
					if(bFilter && bSearch) {
						return this._oResourceBundle.getText("activeFilterInfoBarLabelText1EmployeeFilterAndSearch", aParameters);
					}
				} else {
					if(bFilter && !bSearch) {
						return this._oResourceBundle.getText("activeFilterInfoBarLabelTextNEmployeeFilter", aParameters);
					}
					if(!bFilter && bSearch) {
						return this._oResourceBundle.getText("activeFilterInfoBarLabelTextNEmployeeSearch", aParameters);
					}
					if(bFilter && bSearch) {
						return this._oResourceBundle.getText("activeFilterInfoBarLabelTextNEmployeeFilterAndSearch", aParameters);
					}
				}
			}
			return undefined;
		}

	});

	return TeamCalendarControl;
});
