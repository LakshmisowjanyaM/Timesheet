/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object"
], function(UI5Object) {
	"use strict";
	
	
	var sPernrCharacterMap = {"0": "9", "1": "8", "2": "7", "3": "6", "4": "5", "5": "4", "6": "3", "7": "2", "8": "1", "9": "0"};
	
	var EncodeUtil = UI5Object.extend("hcm.fab.lib.common.util.EncodeUtil", {});
	
	EncodeUtil.encodePernrToUrl = function(pernr) {
		if(typeof pernr !== "string") {
			return pernr;
		}
		var _pernr = "";
		for(var i=0; i<pernr.length; i++) {
			_pernr += sPernrCharacterMap[pernr.charAt(i)];
		}
		return parseInt(_pernr, 10).toString(16);
	};
	EncodeUtil.decodePernrFromUrl = function(pernr) {
		if(typeof pernr !== "string") {
			return pernr;
		}
		var _pernr = "" + parseInt(pernr, 16);
		var result = "";
		for(var i=0; i<_pernr.length; i++) {
			result += sPernrCharacterMap[_pernr.charAt(i)];
		}
		return result;
	};
	return EncodeUtil;
});
