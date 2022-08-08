/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object",
	"hcm/fab/lib/common/localService/mockserver"
], function(UI5Object, MockServer) {
	"use strict";

	var _sDefaultEmployeeId;
	var _bIsMockServerActive = false;
	var MockServerUtil = UI5Object.extend("hcm.fab.lib.common.util.MockServerUtil", {});

	MockServerUtil.startCommonLibraryMockServer = function() {
		_bIsMockServerActive = true;

		MockServer.init();
	};

	MockServerUtil.isMockServerActive = function() {
		return _bIsMockServerActive;
	};

	MockServerUtil.getDefaultEmployeeId = function() {
		if (!MockServerUtil.isMockServerActive) {
			return undefined;
		}
		if (!_sDefaultEmployeeId) {
			var serviceUrl = MockServer.getServiceUrl();
			var oCEResponse = jQuery.sap.sjax({
				url: serviceUrl + "/ConcurrentEmploymentSet?$filter=IsDefaultAssignment eq true"
			});
			_sDefaultEmployeeId = oCEResponse.data.d.results[0].EmployeeId;
		}
		return _sDefaultEmployeeId;
	};

	MockServerUtil.registerFilterOnDefaultAssignment = function(oMockServer, sEntitySetName, sPernrPropertyName) {
		oMockServer.attachAfter("GET", function(oEvent) {
			var url = oEvent.getParameter("oXhr").url;
			var regex = new RegExp("^\\/sap\\/opu\\/odata\\/sap\\/\\w+\\/(" + sEntitySetName + ")\\/?(\\$.*)?(\\?(.*))?$");
			var match = url.match(regex);
			if (match) {
				var filterRegex = new RegExp("$filter\\=.*" + sPernrPropertyName + "(\\s|\\+|\\%20)?\\=");
				if (url.match(filterRegex) === null) {
					var pernr = MockServerUtil.getDefaultEmployeeId();
					var oData = oEvent.getParameter("oFilteredData");
					oData.results = oData.results.filter(function(o) {
						return o[sPernrPropertyName] === pernr;
					});
				}
			}
		}, sEntitySetName);
	};

	return MockServerUtil;
});
