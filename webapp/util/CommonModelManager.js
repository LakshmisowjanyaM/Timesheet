/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/mytimesheet/util/ErrorHandler",
	"sap/ui/base/Object",
	"sap/ui/core/EventBus",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/odata/ODataUtils",
	"sap/ui/model/odata/v2/ODataModel",
	"sap/ui/model/resource/ResourceModel",
	"sap/m/MessageToast"
], function (ErrorHandler, UI5Object, EventBus, Filter, FilterOperator, ODataUtils, ODataModel, ResourceModel, MessageToast) {
	"use strict";

	var _sServiceUrl = "/sap/opu/odata/sap/HCMFAB_COMMON_SRV/";

	var _sPreviousServiceUrl;
	var _oModel;
	var _oI18NModel;
	var _oErrorHandler;
	var _oConcurrentEmploymentRequestPromise;
	var _sSelectedAssignmentId;

	var _oCanUseApplicationIdFilterPromise;
	var _oCanUseOnBehalfEntityPromise;

	var _oApplicationStates = {};
	var _oEventBus = new EventBus();

	var CommonModelManager = UI5Object.extend("hcm.fab.mytimesheet.util.CommonModelManager", {});

	CommonModelManager.getServiceUrl = function () {
		var oService = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService("AppLifeCycle");
		if (!oService) {
			return _sServiceUrl;
		}
		var oCurrentApplication = oService && oService.getCurrentApplication();
		var oConfig = sap.ui.getCore().getConfiguration();
		if (!oCurrentApplication || !oConfig) {
			return _sServiceUrl;
		}

		var oAppComponent = oCurrentApplication.componentInstance;

		// Origin: if sap-system paramter is given -> add this alias to the service url(s) of ODataModels
		var oComponentData = oAppComponent.getComponentData();
		var sSystemParameter = oComponentData && oComponentData.startupParameters && oComponentData.startupParameters["sap-system"];
		// Check the URL as "fallback", the system parameter of the componentData.startup has precedence over a URL parameter
		if (!sSystemParameter) {
			sSystemParameter = oConfig.getSAPParam("sap-system");
		}

		if (sSystemParameter) {
			var sServiceUrlWithOrigin = ODataUtils.setOrigin(_sServiceUrl, {
				alias: sSystemParameter
			});
			return sServiceUrlWithOrigin;
		} else {
			return _sServiceUrl;
		}
	};
	CommonModelManager.getModel = function () {
		var sServiceUrl = CommonModelManager.getServiceUrl();
		if (_sPreviousServiceUrl !== sServiceUrl) {
			_sPreviousServiceUrl = sServiceUrl;
			_oModel = new ODataModel(jQuery.sap.getModulePath("hcm.fab.mytimesheet")+CommonModelManager.getServiceUrl(), {
				useBatch: false
			});
			_oErrorHandler = new ErrorHandler(_oModel, CommonModelManager.getI18NModel());
			_oApplicationStates = {}; //Target system might have changed. Clear buffered data.

			// check what version of the service we have
			var oMetaModel = _oModel.getMetaModel();
			_oCanUseApplicationIdFilterPromise = oMetaModel.loaded().then(function () {
				var sNamespace = oMetaModel.getProperty("/dataServices/schema/0/namespace");
				var oSearchResult = oMetaModel.getODataEntityType(sNamespace + ".ConcurrentEmployment");
				return oMetaModel.getODataProperty(oSearchResult, "ApplicationId") !== null;
			});
			_oCanUseOnBehalfEntityPromise = oMetaModel.loaded().then(function () {
				var sNamespace = oMetaModel.getProperty("/dataServices/schema/0/namespace");
				return oMetaModel.getODataEntityType(sNamespace + ".OnBehalfEmployee") !== null;
			});
		}
		return _oModel;
	};
	CommonModelManager.getI18NModel = function () {
		if (!_oI18NModel) {
			_oI18NModel = new ResourceModel({
				bundleName: "hcm.fab.lib.common.messagebundle"
			});
		}
		return _oI18NModel;
	};
	CommonModelManager.getEventBus = function () {
		return _oEventBus;
	};
	CommonModelManager.getErrorHandler = function () {
		if (!_oErrorHandler) {
			CommonModelManager.getModel();
		}
		return _oErrorHandler;
	};
	CommonModelManager._getAssignmentListLegacy = function (applicationId) {
		if (applicationId) {
			return CommonModelManager._getAssignmentList(applicationId);
		} else {
			if (_oConcurrentEmploymentRequestPromise) {
				return _oConcurrentEmploymentRequestPromise;
			} else {
				_oConcurrentEmploymentRequestPromise = new Promise(function (resolve, reject) {
					var oModel = CommonModelManager.getModel();
					oModel.metadataLoaded().then(function () {
						oModel.read("/ConcurrentEmploymentSet", {
							success: function (oData) {
								resolve(oData.results);
							},
							error: function (oError) {
								reject(oError);
							}
						});
					});
				});
				return _oConcurrentEmploymentRequestPromise;
			}
		}
	};
	CommonModelManager._getAssignmentInformationFromCE = function (pernr, applicationId) {
		return CommonModelManager.getAssignmentList(applicationId).then(function (assignmentList) {
			// check if pernr is from the CE entity list
			var aFoundAssignment = assignmentList.filter(function (oAssignment) {
				return oAssignment.EmployeeId === pernr;
			});
			if (aFoundAssignment.length > 0) {
				return aFoundAssignment[0];
			} else {
				return null;
			}
		});
	};
	CommonModelManager._getAssignmentInformationFromOB = function (pernr, applicationId) {
		var oState = CommonModelManager._getApplicationState(applicationId);
		var sAssignmentId = oState.sAssignmentId; // use on-behalf list for current (CE) assignment
		return CommonModelManager.getOnBehalfEmployeeList(sAssignmentId, applicationId).then(function (onBehalfEmployeeList) {
			// check if pernr is from the CE entity list
			var aFoundEmployee = onBehalfEmployeeList.filter(function (oEmployee) {
				return oEmployee.EmployeeId === pernr;
			});
			if (aFoundEmployee.length > 0) {
				return aFoundEmployee[0];
			} else {
				return null;
			}
		});
	};
	CommonModelManager.getAssignmentInformation = function (assignmentId, applicationId) {
		// check if assignmentId is from the CE entity list
		return CommonModelManager._getAssignmentInformationFromCE(assignmentId, applicationId).then(function (oInfoCE) {
			if (oInfoCE) {
				return oInfoCE;
			} else {
				// check if assignmentId is from the current on-behalf list
				return CommonModelManager._getAssignmentInformationFromOB(assignmentId, applicationId);
			}
		});
		/*		return CommonModelManager.getAssignmentList(applicationId).then(function(assignmentList) {
					var aFoundAssignment = assignmentList.filter(function(oAssignment) {
						return oAssignment.EmployeeId === assignmentId;
					});
					if (aFoundAssignment.length > 0) {
						return aFoundAssignment[0];
					} else {
						return undefined;
					}
				});*/
	};
	CommonModelManager.isConcurrentEmploymentAssignment = function (assignmentId, applicationId) {
		return CommonModelManager._getAssignmentInformationFromCE(assignmentId, applicationId).then(function (oInfoCE) {
			return oInfoCE !== null;
		});
	};
	CommonModelManager.getDefaultAssignment = function (applicationId) {
		return CommonModelManager.getAssignmentList(applicationId).then(function (assignmentList) {
			// try to return previously selected assignment first
			var selectedAssignment = _sSelectedAssignmentId;
			if (applicationId) {
				selectedAssignment = CommonModelManager._getApplicationState(applicationId).sCurrentAssignmentId;
			}
			if (selectedAssignment) {
				var aSelectedAssignment = assignmentList.filter(function (oAssignment) {
					return oAssignment.EmployeeId === selectedAssignment;
				});
				if (aSelectedAssignment.length > 0) {
					return aSelectedAssignment[0];
				}
			}

			// return default assignment
			var aDefaultAssignment = assignmentList.filter(function (assignment) {
				return assignment.IsDefaultAssignment;
			});
			if (aDefaultAssignment.length > 0) {
				return aDefaultAssignment[0];
			} else {
				return undefined;
			}
		});
	};
	CommonModelManager._fireAssignmentChangedEvent = function (applicationId, assignmentId, onBehalfEmployeeId) {
		if (_oEventBus) {
			_oEventBus.publish("hcm.fab.mytimesheet", "assignmentChanged", {
				applicationId: applicationId,
				assignmentId: assignmentId,
				onBehalfEmployeeId: onBehalfEmployeeId
			});
		}
	};
	CommonModelManager.getSelectedAssignment = function (sApplicationId) {
		var oState = CommonModelManager._getApplicationState(sApplicationId);
		return oState.sCurrentAssignmentId;
	};
	CommonModelManager.setSelectedAssignment = function (sAssignmentId, sApplicationId) {
		if (sApplicationId) {
			var oState = CommonModelManager._getApplicationState(sApplicationId);
			oState.sCurrentAssignmentId = sAssignmentId;

			CommonModelManager._fireAssignmentChangedEvent(sApplicationId, sAssignmentId, null);
		} else {
			_sSelectedAssignmentId = sAssignmentId;
		}
	};
	CommonModelManager.setAssignmentId = function (sAssignmentId, sApplicationId) {
		CommonModelManager.setSelectedAssignment(sAssignmentId, sApplicationId);
	};

	CommonModelManager.getAssignmentList = function (applicationId) {
		if (!applicationId) {
			return CommonModelManager._getAssignmentListLegacy();
		}

		var oState = CommonModelManager._getApplicationState(applicationId);
		if (oState.oConcurrentEmploymentRequest) {
			return oState.oConcurrentEmploymentRequest;
		} else {
			var oModel = CommonModelManager.getModel();
			return _oCanUseApplicationIdFilterPromise.then(function (bCanUseApplicationIdFilter) {
				oState.oConcurrentEmploymentRequest = new Promise(function (resolve, reject) {
					var aFilter = [];
					if (bCanUseApplicationIdFilter) {
						aFilter.push(new Filter("ApplicationId", FilterOperator.EQ, applicationId));
					}
					oModel.read("/ConcurrentEmploymentSet", {
						filters: aFilter,
						success: function (oData) {
							resolve(oData.results);
						},
						error: function (oError) {
							reject(oError);
						}
					});
				});
				return oState.oConcurrentEmploymentRequest;
			});
		}
	};

	CommonModelManager.getOnBehalfEmployeeInformation = function (assignmentId, onBehalfEmployeeId, applicationId) {
		return CommonModelManager.getOnBehalfEmployeeList(assignmentId, applicationId).then(function (onBehalfList) {
			var aFoundOnBehalfEmployee = onBehalfList.filter(function (oOnBehalfEmployee) {
				return oOnBehalfEmployee.EmployeeId === onBehalfEmployeeId;
			});
			if (aFoundOnBehalfEmployee.length > 0) {
				return aFoundOnBehalfEmployee[0];
			} else {
				return undefined;
			}
		});
	};
	CommonModelManager.getOnBehalfEmployeeList = function (assignmentId, applicationId) {
		var oState = CommonModelManager._getApplicationState(applicationId);
		if (oState.oOnBehalfRequest && oState.sAssignmentId === assignmentId) {
			return oState.oOnBehalfRequest;
		} else {
			if (oState.onBehalfRequest) {
				// reject old promise, cancel request?? -> for now only reuse promise and assume that it is already resolved
			}
			return _oCanUseOnBehalfEntityPromise.then(function (bCanUseOnBehalfEntity) {
				if (bCanUseOnBehalfEntity) {
					oState.sAssignmentId = assignmentId;
					oState.oOnBehalfRequest = new Promise(function (resolve, reject) {
						var oModel = CommonModelManager.getModel();
						oModel.read("/OnBehalfEmployeeSet", {
							filters: [
								new Filter("ApplicationId", FilterOperator.EQ, applicationId),
								new Filter("RequesterNumber", FilterOperator.EQ, assignmentId)
							],
							urlParameters: {
								"$expand": "toEmployeePicture"
							},
							success: function (oData) {
								resolve(oData.results);
							},
							error: function (oError) {
								reject(oError);
							}
						});
					});
					return oState.oOnBehalfRequest;
				} else {
					return Promise.resolve([]);
				}
			});
		}
	};
	CommonModelManager.getSelectedOnBehalfEmployeeId = function (sApplicationId) {
		var oState = CommonModelManager._getApplicationState(sApplicationId);
		return oState.sCurrentOnBehalfEmployeeId;
	};
	CommonModelManager.setOnBehalfEmployeeId = function (assignmentId, onBehalfEmployeeId, applicationId) {
		/*		var oState = this._getApplicationState(applicationId);
				oState.activatedOnBehalf = true;*/
		var oState = CommonModelManager._getApplicationState(applicationId);
		var bOBStateChanged = oState.sCurrentOnBehalfEmployeeId !== onBehalfEmployeeId;
		oState.sCurrentAssignmentId = assignmentId;
		oState.sCurrentOnBehalfEmployeeId = onBehalfEmployeeId;

		if (bOBStateChanged) {
			CommonModelManager._fireAssignmentChangedEvent(applicationId, assignmentId, onBehalfEmployeeId);
			CommonModelManager._showOnBehalfMessageToast(applicationId, assignmentId, onBehalfEmployeeId);
		}
	};
	CommonModelManager.isOnBehalfActive = function (applicationId) {
		var oState = CommonModelManager._getApplicationState(applicationId);
		return !!oState.sCurrentOnBehalfEmployeeId;
	};
	CommonModelManager.setActivatedOnBehalf = function (applicationId, value) {
		var oState = this._getApplicationState(applicationId);
		oState.activatedOnBehalf = value;
	};
	CommonModelManager.canDeactivateOnBehalf = function (applicationId) {
		var oState = this._getApplicationState(applicationId);
		return oState.activatedOnBehalf;
	};
	CommonModelManager.resetApplicationState = function (applicationId, fullReset) {
		var oState = CommonModelManager._getApplicationState(applicationId);

		// if onbehalf is active and was activated externally, manually disable it to show the appropriate message
		if (CommonModelManager.isOnBehalfActive(applicationId) && !CommonModelManager.canDeactivateOnBehalf(applicationId)) {
			CommonModelManager._showOnBehalfMessageToast(applicationId, oState.sCurrentAssignmentId, null);
		}

		if (oState) {
			if (fullReset) {
				// reset all properties
				delete _oApplicationStates[applicationId];
			} else {
				// only reset minimal properties
				oState.sCurrentAssignmentId = null;
				oState.sCurrentOnBehalfEmployeeId = null;
				oState.activatedOnBehalf = false;
			}
		}
	};

	CommonModelManager._getApplicationState = function (applicationId) {
		if (!_oApplicationStates[applicationId]) {
			_oApplicationStates[applicationId] = {
				sCurrentAssignmentId: null,
				oConcurrentEmploymentRequest: null,
				sAssignmentId: null, // assignment for which onbehalf was last read,
				oOnBehalfRequest: null,
				sCurrentOnBehalfEmployeeId: null,
				activatedOnBehalf: false // indicator that on behalf was activated by the given app (and not by another on in the navigation path)
			};
		}
		return _oApplicationStates[applicationId];
	};

	CommonModelManager._showOnBehalfMessageToast = function (applicationId, assignmentId, onBehalfEmployeeId) {
		var oI18N = CommonModelManager.getI18NModel();
		if (onBehalfEmployeeId) {
			// show message that onbehalf was activated
			Promise.all([
				CommonModelManager.getAssignmentInformation(assignmentId, applicationId),
				CommonModelManager.getOnBehalfEmployeeInformation(assignmentId, onBehalfEmployeeId, applicationId)
			]).then(function (aResults) {
				var oOnBehalfEmployee = aResults[1];

				// build employee name
				if (oOnBehalfEmployee) {
					var employeeName = oOnBehalfEmployee.EmployeeName;
					if (oOnBehalfEmployee.ShowEmployeeNumber) {
						var employeeId = oOnBehalfEmployee.ShowEmployeeNumberWithoutZeros ? parseInt(oOnBehalfEmployee.EmployeeId, 10) :
							oOnBehalfEmployee.EmployeeId;
						employeeName += " (" + employeeId + ")";
					}

					MessageToast.show(oI18N.getProperty("onBehalfActivatedText").replace("{0}", employeeName));
				}
			}.bind(this));
		} else {
			MessageToast.show(oI18N.getProperty("onBehalfDeactivatedText"));
		}
	};

	return CommonModelManager;
});