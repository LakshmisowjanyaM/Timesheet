/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/lib/common/util/CommonModelManager",
	"hcm/fab/lib/common/util/DateUtil",
	"sap/ui/base/ManagedObject",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function(CommonModelManager, DateUtil, ManagedObject, Filter, FilterOperator) {
	"use strict";

	return ManagedObject.extend("hcm.fab.lib.common.util.TeamCalendarDataManager", {

		REASON_OUTDATED_CALL: 1,

		metadata: {
			library: "hcm.fab.lib.common",
			events: {
				uiSettingsChanged: {
					parameters: {
						uiSettings: {
							type: "object"
						}
					}
				},
				viewListChanged: {
					parameters: {
						viewList: {
							type: "object[]"
						},
						selectedView: {
							type: "object"
						}
					}
				}
			}
		},

		constructor: function(applicationId, instanceId, oConfiguration) {

			// Call parent constructor
			if (ManagedObject) {
				ManagedObject.call(this);
			}

			this._sApplicationId = applicationId;
			this._sInstanceId = instanceId;
			this._bLeaveRequestMode = false;
			this._bLeaveRequestSimulateRequest = false;
			this._oLeaveRequestStartDate = null;
			this._oLeaveRequestEndDate = null;
			this._oLeaveRequestDescription = "";
			this._sAssignmentId = null;
			this._sRequesterId = null;
			this._oCurrentView = null;
			this._iMSecPerDay = 24 * 60 * 60 * 1000;
			this._oBuffer = {
				aViews: null,
				oEmployeeEvents: {}, // Employee objects with embedded events (stored by pernr)
				oEmployeeListSorted: [], // Employee objects in display order
				aReadTimes: [],
				oUISettings: null
			};
			this._iCurrentRequestId = 0;

			// Default settings
			this._iBufferReadAheadSize = 40;
			this._oMetaModel = null;
			this._oModel = CommonModelManager.getModel();
			this._oResourceBundle = CommonModelManager.getI18NModel().getResourceBundle();

			// Process configuration object
			if (oConfiguration) {
				if (oConfiguration.bufferReadAheadSize) {
					this._iBufferReadAheadSize = oConfiguration.bufferReadAheadSize;
				}
				if (oConfiguration.model) {
					this._oModel = oConfiguration.model;
				}
			}
		},
		
		_readUISettingsBuffered: function(iRequestId) {
			// Default values
			var sApplicationId = this._sApplicationId ? this._sApplicationId : "";
			var sInstanceId = this._sInstanceId ? this._sInstanceId : "";

			// Is it required to read the settings?
			if (!this._oBuffer.oUISettings) {

				// Read settings for default assignment
				if (this._sAssignmentId) {
					var oSettingsKey =  {
						ApplicationId: sApplicationId,
						InstanceId: sInstanceId,
						EmployeeAssignment: this._sAssignmentId
					};
					this._oModel.read(this._oModel.createKey("/TeamCalendarUISettingsSet", oSettingsKey), {
						success: function(oData) {
							// Validate if this call is still recent
							if (this._iCurrentRequestId !== iRequestId) {
								return;
							}
							this._setUISettingsBuffer(oData);
						}.bind(this)
					});
					
				} else {
					// No assignment known, use function import to determine the settings for default assignment
					this._oModel.callFunction("/GetUISettingsForDefaultAssignment", {
						method: "GET",
						urlParameters: {
							ApplicationId: sApplicationId,
							InstanceId: sInstanceId
						},
						success: function(oData) {
							// Validate if this call is still recent
							if (this._iCurrentRequestId !== iRequestId) {
								return;
							}
							this._setUISettingsBuffer(oData);
						}.bind(this)
					});
				}
			}
			
		},

		_readViewDefinitionBuffered: function(bBufferOnly, iRequestId) {

			// Default values
			var sApplicationId = this._sApplicationId ? this._sApplicationId : "";
			var sInstanceId = this._sInstanceId ? this._sInstanceId : "";

			// Is it required to fill the view buffer?
			if (!this._oBuffer.aViews) {

				// Are we allowed to read from backend?
				if (bBufferOnly) {
					return Promise.reject("Reading calendar views from buffer, but view data is not yet buffered");
				}

				// Read view definitions and event types
				if (this._sAssignmentId) {
					// In case that assignment is known, views and event types can be read by one call
					return new Promise(function(resolve, reject) {
						this._oModel.read("/TeamCalendarViewSet", {
							filters: [
								new Filter("EmployeeAssignment", FilterOperator.EQ, this._sAssignmentId),
								new Filter("ApplicationId", FilterOperator.EQ, sApplicationId),
								new Filter("InstanceId", FilterOperator.EQ, sInstanceId)
							],
							urlParameters: {
								"$expand": "ToTeamCalendarEventType"
							},
							success: function(oData) {
								// Validate if this call is still recent
								if (this._iCurrentRequestId !== iRequestId) {
									reject({
										reason: this.REASON_OUTDATED_CALL
									});
									return;
								}

								this._setViewBuffer(oData.results);
								resolve(this._oBuffer.aViews);
							}.bind(this),
							error: function(oError) {
								reject(oError);
							}
						});
					}.bind(this));
				} else {
					// No assignment known, use two function imports to determine views and event types separately for default assignment
					var oPromiseViews = new Promise(function(resolve, reject) {
						this._oModel.callFunction("/GetViewsForDefaultAssignment", {
							method: "GET",
							urlParameters: {
								ApplicationId: sApplicationId,
								InstanceId: sInstanceId
							},
							success: function(oData) {
								// Validate if this call is still recent
								if (this._iCurrentRequestId !== iRequestId) {
									reject({
										reason: this.REASON_OUTDATED_CALL
									});
									return;
								}
								resolve(oData.results);
							}.bind(this),
							error: function(oError) {
								reject(oError);
							}
						});
					}.bind(this));
					var oPromiseEventTypes = new Promise(function(resolve, reject) {
						this._oModel.callFunction("/GetEventTypesForDefaultAssignment", {
							method: "GET",
							urlParameters: {
								ApplicationId: sApplicationId,
								InstanceId: sInstanceId
							},
							success: function(oData) {
								// Validate if this call is still recent
								if (this._iCurrentRequestId !== iRequestId) {
									reject({
										reason: this.REASON_OUTDATED_CALL
									});
									return;
								}
								resolve(oData.results);
							}.bind(this),
							error: function(oError) {
								reject(oError);
							}
						});
					}.bind(this));
					// Fake the results of the expand above
					return Promise.all([oPromiseViews, oPromiseEventTypes]).then(function(results) {
						// TODO Determine PERNR for default assignment and store it as current assignment. Then remove
						// assumption that the first assignment set with setAssignmentId is the default assignment.
						
						results[0].forEach(function(oView) {
							oView.ToTeamCalendarEventType = {
								results: []
							};
							results[1].forEach(function(oEventType) {
								if (this._compareView(oView, oEventType)) {
									oView.ToTeamCalendarEventType.results.push(oEventType);
								}
							}.bind(this));
						}.bind(this));
						this._setViewBuffer(results[0]);
						return this._oBuffer.aViews;
					}.bind(this));
				}

			} else {
				// Use buffered view list
				return Promise.resolve(this._oBuffer.aViews);
			}
		},

		_readEmployeeDataBuffered: function(startDate, endDate, bBufferOnly, iRequestId) {

			// Make sure view definition is also loaded
			var oViewPromise = this._readViewDefinitionBuffered(bBufferOnly, iRequestId);

			// Default values
			var sApplicationId = this._sApplicationId ? this._sApplicationId : "";
			var sInstanceId = this._sInstanceId ? this._sInstanceId : "";
			var sAssignmentId = this._sAssignmentId ? this._sAssignmentId : "";
			var sRequesterId = this._sRequesterId ? this._sRequesterId : "";

			// Make sure start/end dates are only full days and timestamps
			var startDateTimestamp = DateUtil.convertToUTC(startDate).getTime(); //DateUtil.convertToFullDayUTC(startDate).getTime();
			var endDateTimestamp = DateUtil.convertToUTC(endDate).getTime(); //DateUtil.convertToFullDayUTC(endDate).getTime();

			// If in leaverequest mode, make sure that (at least) the whole intervall of the planned leaverequest is part
			// of the requested timeframe.
			var requestStartDateTimestamp = startDateTimestamp;
			var requestEndDateTimestamp = endDateTimestamp;
			if (this._bLeaveRequestMode && this._oLeaveRequestStartDate && this._oLeaveRequestEndDate) {
				var _start = this._oLeaveRequestStartDate.getTime();
				var _end = this._oLeaveRequestEndDate.getTime();
				if (_start < requestStartDateTimestamp) {
					requestStartDateTimestamp = _start;
				}
				if (_end > requestEndDateTimestamp) {
					requestEndDateTimestamp = _end;
				}
			}

			// Calculate the times not yet in the buffer
			var aMissingDays = this._calculateMissingDaysFromBuffer(requestStartDateTimestamp, requestEndDateTimestamp);

			// Nothing to read from backend? Resolve promise from buffer directly
			if (aMissingDays.length === 0) {
				return oViewPromise.then(function() {
					return Promise.resolve(this._getPersonTimeEventsFromBuffer(startDateTimestamp, endDateTimestamp));
				}.bind(this));
			}

			// Requested to read from buffer only and data is not in buffer?
			if (aMissingDays.length !== 0 && bBufferOnly) {
				return oViewPromise.then(function() {
					return Promise.reject("Reading calendar data from buffer, but requested data is not yet buffered");
				});
			}

			// Use earliest and latest missing day, so that only one chunk of data is requested and buffered data is not
			// unnecessary requested again.
			//
			// Example: (b = buffered day, - = unbuffered day)
			// Requested:    startdate                            enddate
			//                   v                                   v
			// Buffer:       b b b b b b - - - - b b b b b - - - - b b b b b
			//                           ^                       ^
			// Calculated:           startdate                enddate
			requestStartDateTimestamp = null;
			requestEndDateTimestamp = null;
			aMissingDays.forEach(function(element) {
				requestStartDateTimestamp = (!requestStartDateTimestamp || requestStartDateTimestamp > element) ? element :
					requestStartDateTimestamp;
				requestEndDateTimestamp = (!requestEndDateTimestamp || requestEndDateTimestamp < element) ? element : requestEndDateTimestamp;
			});

			// Not the whole request can be served from the buffer, make sure that we read a big enough block from the backend
			var diffDays = Math.floor((requestEndDateTimestamp - requestStartDateTimestamp) / this._iMSecPerDay);
			if (diffDays < this._iBufferReadAheadSize) {
				aMissingDays = this._calculateMissingDaysFromBuffer(requestStartDateTimestamp, requestStartDateTimestamp + (this._iBufferReadAheadSize *
					this._iMSecPerDay));

				// Missing days changed because of to small chunk. Recalculate actual request intervall
				requestStartDateTimestamp = null;
				requestEndDateTimestamp = null;
				aMissingDays.forEach(function(element) {
					requestStartDateTimestamp = (!requestStartDateTimestamp || requestStartDateTimestamp > element) ? element :
						requestStartDateTimestamp;
					requestEndDateTimestamp = (!requestEndDateTimestamp || requestEndDateTimestamp < element) ? element : requestEndDateTimestamp;
				});
			}

			// Displayed view is known?
			if (this._oCurrentView) {

				// No requester set yet? We cannot handle this request...
				if (!this._sAssignmentId) {
					return oViewPromise.then(function() {
						return Promise.reject("TeamCalendarEmployeeSet requested without assignment");
					});
				}

				var aFilter = [
					new Filter("ApplicationId", FilterOperator.EQ, this._oCurrentView.ApplicationId),
					new Filter("InstanceId", FilterOperator.EQ, this._oCurrentView.InstanceId),
					new Filter("ViewType", FilterOperator.EQ, this._oCurrentView.ViewType),
					new Filter("ViewId", FilterOperator.EQ, this._oCurrentView.ViewId),
					new Filter("StartDate", FilterOperator.EQ, new Date(requestStartDateTimestamp)),
					new Filter("EndDate", FilterOperator.EQ, new Date(requestEndDateTimestamp)),
					new Filter("EmployeeAssignment", FilterOperator.EQ, this._sAssignmentId)
				];
				if(this._sRequesterId) {
					aFilter.push( new Filter("RequesterId", FilterOperator.EQ, this._sRequesterId) );
				}

				// Request employees for this view (if needed)
				var oEmployeePromise;
				if (Object.keys(this._oBuffer.oEmployeeEvents).length > 0) {
					oEmployeePromise = Promise.resolve(this._oBuffer.oEmployeeEvents);
				} else {
					oEmployeePromise = new Promise(function(resolve, reject) {
						this._oModel.read("/TeamCalendarEmployeeSet", {
							filters: aFilter,
							success: function(oData) {
								// Validate if this call is still recent
								if (this._iCurrentRequestId !== iRequestId) {
									reject({
										reason: this.REASON_OUTDATED_CALL
									});
									return;
								}
								this._insertPersonDataIntoBuffer(oData.results);
								resolve(oData.results);
							}.bind(this),
							error: function(oError) {
								reject(oError);
							}
						});
					}.bind(this));
				}

				// Always request event data
				var oEventPromise = new Promise(function(resolve, reject) {
					this._oModel.read("/TeamCalendarEventSet", {
						filters: aFilter,
						success: function(oData) {
							// Validate if this call is still recent
							if (this._iCurrentRequestId !== iRequestId) {
								reject({
									reason: this.REASON_OUTDATED_CALL
								});
								return;
							}
							resolve(oData.results);
						}.bind(this),
						error: function(oError) {
							reject(oError);
						}
					});
				}.bind(this));

				// Wait until all requests are processed
				return Promise.all([oEmployeePromise, oEventPromise, oViewPromise]).then(function(result) {
					//	this._insertPersonDataIntoBuffer(result[0]);
					this._insertEventDataIntoBuffer(aMissingDays, result[1]);
					return this._getPersonTimeEventsFromBuffer(startDateTimestamp, endDateTimestamp);
				}.bind(this));

			} else {

				// Read employees for the default view (and potentially the default assignment)
				var oPromiseEmployees = new Promise(function(resolve, reject) {
					this._oModel.callFunction("/GetEmployeesForDefaultView", {
						method: "GET",
						urlParameters: {
							ApplicationId: sApplicationId,
							InstanceId: sInstanceId,
							StartDate: new Date(requestStartDateTimestamp),
							EndDate: new Date(requestEndDateTimestamp),
							EmployeeAssignment: sAssignmentId,
							RequesterId: sRequesterId
						},
						success: function(oData) {
							// Validate if this call is still recent
							if (this._iCurrentRequestId !== iRequestId) {
								reject({
									reason: this.REASON_OUTDATED_CALL
								});
								return;
							}
							this._insertPersonDataIntoBuffer(oData.results);
							resolve(oData.results);
						}.bind(this),
						error: function(oError) {
							reject(oError);
						}
					});
				}.bind(this));

				// Read all events for the default view (and potentially the default assignment)
				var oPromiseEvents = new Promise(function(resolve, reject) {
					this._oModel.callFunction("/GetEventsForDefaultView", {
						method: "GET",
						urlParameters: {
							ApplicationId: sApplicationId,
							InstanceId: sInstanceId,
							StartDate: new Date(requestStartDateTimestamp),
							EndDate: new Date(requestEndDateTimestamp),
							EmployeeAssignment: sAssignmentId,
							RequesterId: sRequesterId
						},
						success: function(oData) {
							// Validate if this call is still recent
							if (this._iCurrentRequestId !== iRequestId) {
								reject({
									reason: this.REASON_OUTDATED_CALL
								});
								return;
							}
							resolve(oData.results);
						}.bind(this),
						error: function(oError) {
							reject(oError);
						}
					});
				}.bind(this));

				return Promise.all([oPromiseEmployees, oPromiseEvents, oViewPromise]).then(function(result) {
					this._insertEventDataIntoBuffer(aMissingDays, result[1]);
					return this._getPersonTimeEventsFromBuffer(startDateTimestamp, endDateTimestamp);
				}.bind(this));
			}
		},
		
		_setUISettingsBuffer: function(oUISettings) {
			this._oBuffer.oUISettings = oUISettings;
			this.fireUiSettingsChanged({uiSettings: oUISettings});
		},

		_setViewBuffer: function(aViewList) {
			this._oBuffer.aViews = aViewList;

			// Remember that the current view is displayed
			var oSelectedView = this.getDisplayedView();
			if(!oSelectedView) {
				var aDefaultView = this._oBuffer.aViews.filter(function(oView) {
					return oView.IsDefaultView;
				});
				if (aDefaultView.length > 0) {
					oSelectedView = aDefaultView[0];
					this.setView(oSelectedView);
				}
			} else {
				var aViews = this._oBuffer.aViews.filter(function(oView) {
					return this._compareView(oSelectedView, oView);
				}.bind(this));
				if (aViews.length > 0) {
					oSelectedView = aViews[0];
					this._oCurrentView = oSelectedView;
				}
			}

			// Fire viewListChanged event
			this.fireViewListChanged({
				viewList: aViewList,
				selectedView: oSelectedView
			});
		},
		
		getUISettings: function() {
			return this._oBuffer.oUISettings;
		},

		getViewList: function() {
			return this._oBuffer.aViews;
		},

		getEventTypesForCurrentView: function() {
			var oView = this._oCurrentView;
			for (var i = 0; i < this._oBuffer.aViews.length; i++) {
				if (oView.ApplicationId === this._oBuffer.aViews[i].ApplicationId && oView.InstanceId === this._oBuffer.aViews[i].InstanceId &&
					oView.ViewType === this._oBuffer.aViews[i].ViewType && oView.ViewId === this._oBuffer.aViews[i].ViewId) {
					if (this._oBuffer.aViews[i].ToTeamCalendarEventType) {
						return this._oBuffer.aViews[i].ToTeamCalendarEventType.results.map(function(oEventType) {
							if(oEventType.DetailFields) {
								return oEventType;
							} else {
								// DetailField not there or empty -> use default value
								var oType = jQuery.extend({}, oEventType);
								oType.DetailFields = "{Title},{DATERANGE},{TIMERANGE},{TYPE_STATUS}";
								return oType;
							}
						});
					} else {
						return [];
					}
				}
			}
			return [];
		},

		setApplicationId: function(applicationId) {
			this._sApplicationId = applicationId;
			this._refreshBufferViewDefinition();
		},

		setInstanceId: function(instanceId) {
			this._sInstanceId = instanceId;
			this._refreshBufferViewDefinition();
		},

		setLeaveRequestMode: function(leaveRequestMode) {
			this._bLeaveRequestMode = leaveRequestMode;
		},

		setLeaveRequestSimulateRequest: function(leaveRequestSimulateRequest) {
			this._bLeaveRequestSimulateRequest = leaveRequestSimulateRequest;
		},

		setLeaveRequestStartDate: function(leaveRequestStartDate) {
			this._oLeaveRequestStartDate = leaveRequestStartDate;
		},

		setLeaveRequestEndDate: function(leaveRequestEndDate) {
			this._oLeaveRequestEndDate = leaveRequestEndDate;
		},

		setLeaveRequestDescription: function(leaveRequestDescription) {
			this._oLeaveRequestDescription = leaveRequestDescription;
		},

		setView: function(oView) {
			// Is it the same view?
			if (this._oCurrentView && this._compareView(oView, this._oCurrentView)) {
				return false;
			}

			// Only clear buffers if we actually changed views. Not change if we initially change to the default view
			if (!(!this._oCurrentView && oView.IsDefaultView)) {
				// Clear old buffer data
				this._refreshBufferEmployeeData();
			}
			
			// Find this view in the internal view buffer (so that view has all internal properties, not just key)
			if(this._oBuffer.aViews !== null) {
				var aViews = this._oBuffer.aViews.filter(function(oCurrentView) {return this._compareView(oView, oCurrentView);}.bind(this));
				if(aViews.length !== 1) {
					return false;
				}
			} else {
				aViews = [oView]; // Remember potentially incomplete object and overwrite it later
			}
			
			this._oCurrentView = aViews[0];
		},

		getDisplayedView: function() {
			return this._oCurrentView;
		},

		setAssignmentId: function(assignmentId) {
			// Only use valid assignments
			if (!assignmentId) {
				return false; // Assignment did not change
			}

			// Same assignment as before?
			var bChanged = false;
			if (this._sAssignmentId) {
				if (this._sAssignmentId === assignmentId) {
					return false; // Assignment did not change
				} else {
					// Clear old buffer data, since assignment really changed
					this._refreshBufferViewDefinition();
					bChanged = true;
				}
			}

			this._sAssignmentId = assignmentId;
			return bChanged;
		},

		setRequesterId: function(requesterId) {
			// Only use valid requesters
			if (!requesterId) {
				return false; // Requester did not change
			}

			// Same requester as before?
			if (this._sRequesterId === requesterId) {
				return false; // Requester did not change
			} else {
				// Clear old buffer data, since requester really changed
				this._refreshBufferViewDefinition();
				this._sRequesterId = requesterId;
				return true;
			}
		},

		getCalendarData: function(startDate, endDate, bBufferOnly) {

			if(!this._oMetaModel) {
				this._oModel.getMetaModel().loaded().then(function() {
					this._sServiceNamespace = this._oModel.getServiceMetadata().dataServices.schema[0].namespace;
					this._oMetaModel = this._oModel.getMetaModel();
				}.bind(this));
			}

			// Default parameters
			var _bBufferOnly = bBufferOnly;
			if (typeof _bBufferOnly === "undefined") {
				_bBufferOnly = false;
			}

			this._iCurrentRequestId++; // Generate new call id to identify if this request is still valid when handling the results
			
			// Make sure that UI settings are up-to-date
			this._readUISettingsBuffered(this._iCurrentRequestId);
			
			return this._readEmployeeDataBuffered(startDate, endDate, bBufferOnly, this._iCurrentRequestId);
		},
		
		getEmployeeList: function(bIgnoreDisplayState) {
			return this._getPersonListFromBuffer(bIgnoreDisplayState);
		},
		
		refreshBuffer: function(bRefreshViews, bRefreshEmployees) {
			if(bRefreshViews) {
				this._refreshBufferViewDefinition();
			} else {
				if(bRefreshEmployees) {
					this._refreshBufferEmployeeData();
				}
			}
		},
		
		_compareView: function(oView1, oView2) {
			if(oView1 === oView2) {
				return true;
			}
			if(!oView1 || !oView2) {
				return false;
			}
			return oView1.ApplicationId === oView2.ApplicationId && oView1.InstanceId === oView2.InstanceId &&
				oView1.ViewType === oView2.ViewType && oView1.ViewId === oView2.ViewId;
		},

		_refreshBufferViewDefinition: function() {
			this._oCurrentView = null;
			this._oBuffer.aViews = null;
			this._oBuffer.oUISettings = null;
			this._refreshBufferEmployeeData();
		},

		_refreshBufferEmployeeData: function() {
			this._oBuffer.oEmployeeEvents = {};
			this._oBuffer.oEmployeeListSorted = [];
			this._oBuffer.aReadTimes = [];
		},

		_calculateMissingDaysFromBuffer: function(startDateTimestamp, endDateTimestamp) {
			// Reduce read days to read interval
			var aReadDays = this._oBuffer.aReadTimes.filter(function(element) {
				return element >= startDateTimestamp && element <= endDateTimestamp;
			});

			// Calculate missing days
			var aMissingDays = [];
			for (var day = startDateTimestamp; day <= endDateTimestamp; day += this._iMSecPerDay) {
				if (aReadDays.indexOf(day) === -1) {
					aMissingDays.push(day);
				}
			}

			return aMissingDays;
		},
		
/*		_replacePlaceholder: function(sPlaceholderString, fnReplaceCallback) {
			var sResult = "";
			var sSource = sPlaceholderString;
			while(sSource.length > 0) {
				// find next placeholder to replace
				var aMatch = sSource.match(/(.*)(\{\w+\})(.*)/);
				if(aMatch !== null) {
					sResult = sResult + aMatch[1] + fnReplaceCallback(aMatch[2]);
					sSource = aMatch[3];
				} else {
					sResult = sResult + sSource;
					break;
				}
			}
			return sResult;
		},*/
		
		_getLabelTextForPropertyPlaceholder: function(sPlaceholder, sEntityName, sLabelText) {
			// read the sap:label property from the metadata of the field
			var aMatch = sPlaceholder.match(/\{(\w+)\}/);
			if(aMatch) {
				var sPropertyName = aMatch[1];
				var oEntityType = this._oMetaModel.getODataEntityType(this._sServiceNamespace + "." + sEntityName);
				var oProperty = this._oMetaModel.getODataProperty(oEntityType, sPropertyName);
				if(oProperty) {
					return oProperty["sap:label"];
				}
			}
			return "";
		},
		
		_replacePropertyPlaceholders: function(sPlaceholder, oObject) {
			var aMatch = sPlaceholder.match(/\{(\w+)\}/);
			if(aMatch) {
				var sPropertyName = aMatch[1];
				if(oObject.hasOwnProperty(sPropertyName)) {
					return oObject[sPropertyName];
				} else {
					return sPlaceholder;
				}
			}
			return sPlaceholder;
		},
		
		_replaceEmployeePlaceholders: function(sText, oEmployee) {
			return this._replacePropertyPlaceholders(sText, oEmployee);
		},

		_replaceEventPlaceholders: function(sText, oEvent) {
			if (!sText) {
				return "";
			} else {
				var resultText = this._replacePropertyPlaceholders(sText, oEvent);
				if (resultText.indexOf("{DATERANGE}") !== -1) {
					resultText = resultText.replace("{DATERANGE}", DateUtil.formatDateRange(oEvent.StartDate, oEvent.EndDate) || "");
				}
				if(resultText.indexOf("{TIMERANGE}") !== -1) {
					resultText = resultText.replace("{TIMERANGE}", DateUtil.formatTimeRange(oEvent.StartTime, oEvent.EndTime) || "");
				}
				if(resultText.indexOf("{DURATION}") !== -1) {
					var durationText = "";
					if(DateUtil.isSameDay(oEvent.StartDate, oEvent.EndDate)) {
						if(oEvent.StartTime.ms === 0 || oEvent.EndTime.ms === 0) {
							durationText = this._oResourceBundle.getText("eventDetailViewDurationSingleDay", 1);
						} else {
							var diffHours = Math.round((oEvent.EndTime.ms - oEvent.StartTime.ms) / (3600 * 1000));
							var diffMinutes = Math.round((oEvent.EndTime.ms - oEvent.StartTime.ms) / (60 * 1000)) % 60;
							
							var textHoursAlias = diffHours === 1 ? "eventDetailViewDurationSingleHour" : "eventDetailViewDurationMultipleHours";
							var textMinutesAlias = diffHours === 1 ? "eventDetailViewDurationSingleMinute" : "eventDetailViewDurationMultipleMinutes";
							
							if(diffHours && diffMinutes) {
								durationText = this._oResourceBundle.getText("eventDetailViewDurationHoursAndMinutes", [
									this._oResourceBundle.getText(textHoursAlias, diffHours),
									this._oResourceBundle.getText(textMinutesAlias, diffMinutes)
								]);
							} else {
								if(diffMinutes) {
									durationText = this._oResourceBundle.getText(textMinutesAlias, diffMinutes);
								} else {
									durationText = this._oResourceBundle.getText(textHoursAlias, diffHours);
								}
							}
						}
					} else {
						var diffDays = Math.round((oEvent.EndDate.getTime() - oEvent.StartDate.getTime()) / (24 * 3600 * 1000));
						if(diffDays === 1) {
							durationText = this._oResourceBundle.getText("eventDetailViewDurationSingleDay", diffDays);
						} else {
							durationText = this._oResourceBundle.getText("eventDetailViewDurationMultipleDays", diffDays);
						}
					}
					resultText = resultText.replace("{DURATION}", durationText);
				}
				if(resultText.indexOf("{TYPE_STATUS}") !== -1) {
					var oEventType = this.getEventTypeForEvent(oEvent);
					if(oEvent.AbsenceStatusText) {
						resultText = resultText.replace("{TYPE_STATUS}", this._oResourceBundle.getText("eventDetailViewTypeStatusTitle", [oEventType.Description, oEvent.AbsenceStatusText]));
					} else {
						if(oEvent.IsTentative) {
							resultText = resultText.replace("{TYPE_STATUS}", this._oResourceBundle.getText("eventDetailViewTypeTentativeTitle", oEventType.Description));
						} else {
							resultText = resultText.replace("{TYPE_STATUS}", oEventType.Description);
						}
					}
				}
				if(resultText.indexOf("{CATEGORY}") !== -1) {
					resultText = resultText.replace("{CATEGORY}", this.getEventTypeForEvent(oEvent).Description);
				}
				if(resultText.indexOf("{ABSENCETYPE_OPERATION}") !== -1) {
					switch(oEvent.AbsenceOperation) {
						case "DEL":
							var sOperationDelText = this._oResourceBundle.getText("eventDetailOperationDel");
							resultText = resultText.replace("{ABSENCETYPE_OPERATION}",
																this._oResourceBundle.getText("eventDetailViewAbsenceTypeOperation", [
																	oEvent.AbsenceTypeText,
																	sOperationDelText
																]));
							break;
						case "MOD":
							var sOperationModText = this._oResourceBundle.getText("eventDetailOperationMod");
							resultText = resultText.replace("{ABSENCETYPE_OPERATION}",
																this._oResourceBundle.getText("eventDetailViewAbsenceTypeOperation", [
																	oEvent.AbsenceTypeText,
																	sOperationModText
																]));
							break;
						default:
							resultText = resultText.replace("{ABSENCETYPE_OPERATION}", oEvent.AbsenceTypeText);
							break;
					}
				}
				return resultText;
			}
		},
		
		_buildFieldList: function(oEvent) {
			var aFields = oEvent.ToEventType.DetailFields.split(",");
			var aLabels = Array(aFields.length).fill("");
			if(oEvent.ToEventType.DetailFieldLabels) {
				var aSuppliedLabels = oEvent.ToEventType.DetailFieldLabels.split(",");
				for(var i = 0; i < aSuppliedLabels.length; i++) {
					aLabels[i] = aSuppliedLabels[i];
				}
			}
			return aFields.map(function(sField, index) {
				var sSuppliedLabel = aLabels[index];
				switch(sField) {
					case "{DATERANGE}":
						return {
							label: sSuppliedLabel || this._oResourceBundle.getText("eventDetailViewDateRangeLabel"),
							value: this._replaceEventPlaceholders(sField, oEvent)
						};
					case "{TIMERANGE}":
						return {
							label: sSuppliedLabel || this._oResourceBundle.getText("eventDetailViewTimeRangeLabel"),
							value: this._replaceEventPlaceholders(sField, oEvent)
						};
					case "{DURATION}":
						return {
							label: sSuppliedLabel || this._oResourceBundle.getText("eventDetailViewDurationLabel"),
							value: this._replaceEventPlaceholders(sField, oEvent)
						};
					case "{TYPE_STATUS}":
						return {
							label: sSuppliedLabel || this._oResourceBundle.getText("eventDetailViewTypeLabel"),
							value: this._replaceEventPlaceholders(sField, oEvent)
						};
					case "{CATEGORY}":
						return {
							label: sSuppliedLabel || this._oResourceBundle.getText("eventDetailViewTypeLabel"),
							value: this._replaceEventPlaceholders(sField, oEvent)
						};
					case "{ABSENCETYPE_OPERATION}":
						return {
							label: sSuppliedLabel || this._oResourceBundle.getText("eventDetailViewDescriptionLabel"),
							value: this._replaceEventPlaceholders(sField, oEvent)
						};
					default:
						return {
							label: sSuppliedLabel || this._getLabelTextForPropertyPlaceholder(sField, "TeamCalendarEvent"),
							value: this._replacePropertyPlaceholders(sField, oEvent)
						};
				}
			}.bind(this)).filter(function(oField) {
				return oField.value ? true : false;
			});
		},
		
		_getPersonListFromBuffer: function(bIgnoreDisplayState) {
			var aEmployees = [];
			this._oBuffer.oEmployeeListSorted.forEach(function(oCurrentEmployee) {
				
				// Copy structure of employee *without* embedded events
				if(!bIgnoreDisplayState && oCurrentEmployee.DisplayState === "HIDDEN") {
					return;
				}
				
				var oEmployee = jQuery.extend({}, oCurrentEmployee); // copy odata properties over
				
				// Default properties
				oEmployee.ToTeamCalendarEvent = [];
				oEmployee.NonWorkingDays = [];
				oEmployee.NonWorkingDates = [];
				oEmployee.ToLeaveRequestEvent = []; // Contains all events that lie during the leaverequest period
				
				// Prevent empty descriptions because PlanningCalendar does not align picture correctly then
				if(!oEmployee.Description) {
					oEmployee.Description = " ";
				}
				
				// Properties that allow placeholders
				oEmployee.Name = this._replaceEmployeePlaceholders(oEmployee.Name, oEmployee);
				oEmployee.Description = this._replaceEmployeePlaceholders(oEmployee.Description, oEmployee);
				if(oEmployee.Tooltip) {
					oEmployee.Tooltip = this._replaceEmployeePlaceholders(oEmployee.Tooltip, oEmployee);
				}
				
				// Fetch picture content from separate EmployeePicture entity
				var sServiceUrl = CommonModelManager.getServiceUrl();
				oEmployee.ImageURL = sServiceUrl + this._oModel.createKey("EmployeePictureSet", oCurrentEmployee) + "/$value";
				
				aEmployees.push(oEmployee);
				
			}.bind(this));

			return aEmployees;
		},

		_getPersonTimeEventsFromBuffer: function(startDateTimestamp, endDateTimestamp) {
			
			var aEmployees = this._getPersonListFromBuffer(false);
			
			aEmployees.forEach(function(oCurrentEmployee, index) {

				// Convert function from buffered event to display event structure
				var fnConvertEvent = function(oCurrentEvent) {
					var oEvent = jQuery.extend({}, oCurrentEvent); // copy properties over
					
					// Convert start and enddate to local timezone
					oEvent.StartDate = DateUtil.convertToLocal(new Date(oEvent.StartDate.getTime()));
					oEvent.EndDate = DateUtil.convertToLocal(new Date(oEvent.EndDate.getTime() + 24 * 60 * 60 * 1000 - 1 * 1000));
					
					// Check for placeholders in description
					oEvent.Title = this._replaceEventPlaceholders(oEvent.Title, oEvent);
					oEvent.Description = this._replaceEventPlaceholders(oEvent.Description, oEvent);
					if(oEvent.Tooltip) {
						oEvent.Tooltip = this._replaceEventPlaceholders(oEvent.Tooltip, oEvent);
					}
					
					// Add event type navigation for convenience
					oEvent.ToEventType = this.getEventTypeForEvent(oCurrentEvent);
					
					// Add utility method for field list generation
					oEvent.getEventDetailFieldList = function() {
						return this._buildFieldList(oEvent);
					}.bind(this);
					
					return oEvent;
				}.bind(this);

				// Find all time events that lie in the given date range
				this._oBuffer.oEmployeeEvents[oCurrentEmployee.EmployeeId].ToTeamCalendarEvent.forEach(function(currentTimeEvent) {
					var start = currentTimeEvent.StartDate.getTime();
					var end = currentTimeEvent.EndDate.getTime();
					var oEvent = fnConvertEvent(currentTimeEvent);

					// check against requested period
					if (start <= endDateTimestamp && end >= startDateTimestamp) {
						if (oEvent.ToEventType.ShowAsNonWorkingDay) {
							var iDay = currentTimeEvent.StartDate.getUTCDay();
							if (oCurrentEmployee.NonWorkingDays.indexOf(iDay) === -1) {
								oCurrentEmployee.NonWorkingDays.push(iDay);
							}
							oCurrentEmployee.NonWorkingDates.push(DateUtil.convertToLocal(currentTimeEvent.StartDate));
						} else {
							oCurrentEmployee.ToTeamCalendarEvent.push(oEvent);
						}
					}

					// in leaverequest mode, check against leaverequest period
					if (this._bLeaveRequestMode && this._oLeaveRequestStartDate && this._oLeaveRequestEndDate) {
						if (start <= this._oLeaveRequestEndDate.getTime() && end >= this._oLeaveRequestStartDate.getTime()) {
							if (oEvent.ToEventType.ShowAsNonWorkingDay) {
								// do nothing for leaverequest array (but exclude the events, so we behave the same as above)
							} else {
								oCurrentEmployee.ToLeaveRequestEvent.push(oEvent);
							}
						}
					}
				}.bind(this));

				// In leaverequest mode, also add a simulated event for the planned leaverequest
				if (this._bLeaveRequestMode && this._bLeaveRequestSimulateRequest && this._oLeaveRequestStartDate && this._oLeaveRequestEndDate &&
					index === 0) {
					var oView = this.getDisplayedView();
					var aTemplateEventTypes = this.getEventTypesForCurrentView().filter(function(oEventType) {
						return oEventType.UseForNewRequestedLeave;
					});
					if (aTemplateEventTypes.length > 0) {
						var oEvent = {
							ApplicationId: oView.ApplicationId,
							Icon: aTemplateEventTypes[0].Icon,
							InstanceId: oView.InstanceId,
							EmployeeId: oCurrentEmployee.EmployeeId,
							EmployeeAssignment: this._sAssignmentId,
							StartDate: DateUtil.convertToLocal(this._oLeaveRequestStartDate),
							ViewType: oView.ViewType,
							EndDate: DateUtil.convertToLocal(this._oLeaveRequestEndDate),
							ViewId: oView.ViewId,
							EventType: aTemplateEventTypes[0].EventType,
							StartTime: {
								ms: 0
							},
							Description: " ",
							Title: this._oLeaveRequestDescription,
							EndTime: {
								ms: 0
							},
							IsTentative: true,
							ToEventType: aTemplateEventTypes[0]
						};
						// Add utility method for field list generation
						oEvent.getEventDetailFieldList = function() {
							return this._buildFieldList(oEvent);
						}.bind(this);
						oCurrentEmployee.ToTeamCalendarEvent.push(oEvent);
					}
				}
				
			}.bind(this));
			
			return aEmployees;
		},

		_insertPersonDataIntoBuffer: function(aEmployeeData) {

			if (!aEmployeeData) {
				return;
			}

			// Update persons buffer (can only happen once)
			var that = this;
			aEmployeeData.forEach(function(currentEmployee) {
				var pernr = currentEmployee.EmployeeId;
				if (!that._oBuffer.oEmployeeEvents[pernr]) {
					currentEmployee.ToTeamCalendarEvent = [];
					that._oBuffer.oEmployeeEvents[pernr] = currentEmployee;
					that._oBuffer.oEmployeeListSorted.push(currentEmployee);
				}
			});
		},

		_insertEventDataIntoBuffer: function(aReadDays, aEventData) {

			if (!aEventData) {
				return;
			}

			// Update events in buffer
			var that = this;
			aEventData.forEach(function(currentEvent) {
				var pernr = currentEvent.EmployeeId;
				var oEmployee = that._oBuffer.oEmployeeEvents[pernr];
				if (oEmployee) {
					var eventStartTime = currentEvent.StartDate.getTime();
					var eventEndTime = currentEvent.EndDate.getTime();

					// Event contains at least one of the missing days?
					if (aReadDays.some(function(currentDay) {
							return eventStartTime <= currentDay && eventEndTime >= currentDay;
						})) {

						// Verify that the time event was not read by a previous request
						if (!that._oBuffer.aReadTimes.some(function(currentDay) {
								return eventStartTime <= currentDay && eventEndTime >= currentDay;
							})) {

							// Time event was not yet read, add it to the buffer
							oEmployee.ToTeamCalendarEvent.push(currentEvent);

						}
					}
				}
			});

			// Update time buffer
			this._oBuffer.aReadTimes = this._oBuffer.aReadTimes.concat(aReadDays);
		},

		getEventTypeForEvent: function(oEvent) {
			var aEventTypes = this.getEventTypesForCurrentView().filter(function(oCurrentEvent) {
				return oCurrentEvent.EventType === oEvent.EventType;
			});
			return (aEventTypes.length > 0) ? aEventTypes[0] : {};
		}

	});
});
