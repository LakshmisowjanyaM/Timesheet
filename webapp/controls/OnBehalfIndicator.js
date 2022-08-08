/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/mytimesheet/util/CommonModelManager",
	"sap/m/MessageStrip",
	"sap/ui/core/Control"
], function(CommonModelManager, MessageStrip, Control) {
	"use strict";

	var OnBehalfIndicator = Control.extend("hcm.fab.mytimesheet.controls.OnBehalfIndicator", {
		metadata: {
			library: "hcm.fab.mytimesheet",
			properties: {
				applicationId: {
					type: "string"
				}
			},
			aggregations: {
				_messagestrip: {
					type: "sap.m.MessageStrip",
					multiple: false,
					visibility: "hidden"
				}
			}
		},
		
		init: function() {
			if (Control.prototype.init) {
				Control.prototype.init.apply(this, arguments);
			}
			
			this.setAggregation("_messagestrip", new MessageStrip({
				type: "Warning",
				showIcon: true,
				visible: false
			}));
			
			this._oResourceBundle = CommonModelManager.getI18NModel().getResourceBundle();
			
			this._updateMessageStrip(null);
		},
		
		exit: function() {
			// deregister from event bus
			if(this._oEventBus) {
				this._oEventBus.unsubscribe("hcm.fab.mytimesheet", "assignmentChanged", this._handleAssignmentChangedEvent, this);
				this._oEventBus = null;
			}
		},
		
		renderer: function(oRM, oControl) {
			oRM.write("<div");
			oRM.writeControlData(oControl);
			oRM.writeClasses();
			oRM.write(">");

			oRM.renderControl(oControl.getAggregation("_messagestrip"));

			oRM.write("</div>");
		},
		
		setApplicationId: function(applicationId) {
			if(!applicationId) {
				return;
			}
			
			this.setProperty("applicationId", applicationId, true);
			
			this._registerEventBus(applicationId);
		},
		
		_registerEventBus: function(applicationId) {
			if(!this._oEventBus) {
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
		
		_updateMessageStrip: function(assignmentId, onBehalfEmployeeId) {
			var applicationId = this.getApplicationId();
			var oMessageStrip = this.getAggregation("_messagestrip");
			if(onBehalfEmployeeId) {
				Promise.all([
					CommonModelManager.getAssignmentInformation(assignmentId, applicationId),
					CommonModelManager.getOnBehalfEmployeeInformation(assignmentId, onBehalfEmployeeId, applicationId)
				]).then(function(aResults) {
//					var oAssignment = aResults[0];
					var oOnBehalfEmployee = aResults[1];
					
					// build employee name
					var employeeName = oOnBehalfEmployee.EmployeeName;
					if(oOnBehalfEmployee.ShowEmployeeNumber) {
						var employeeId = oOnBehalfEmployee.ShowEmployeeNumberWithoutZeros ? parseInt(oOnBehalfEmployee.EmployeeId, 10) : oOnBehalfEmployee.EmployeeId;
						employeeName += " (" + employeeId + ")";
					}
					
					oMessageStrip.setVisible(true);
					oMessageStrip.setText(this._oResourceBundle.getText("onBehalfActivatedText", employeeName));
				}.bind(this));
			} else {
				oMessageStrip.setVisible(false);
			}
		},
		
		_handleAssignmentChangedEvent: function(sChannelId, sEventId, oData) {
			if(!(sChannelId === "hcm.fab.mytimesheet" && sEventId === "assignmentChanged" && oData.applicationId === this.getApplicationId())) {
				return;
			}
			
			this._updateMessageStrip(oData.assignmentId, oData.onBehalfEmployeeId);
		}
	});
	return OnBehalfIndicator;
});