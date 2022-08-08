/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object"
], function(UI5Object) {
	"use strict";

	var PersInfoUtil = UI5Object.extend("hcm.fab.lib.common.util.PersInfoUtil", {});

	PersInfoUtil.adjustFormGroupsVisibility = function(oView) {
		var oForm = oView.getContent()[0],
			aFormContent = oForm.getContent(),
			oLocalRemovedGroups = {},
			sTitleId = "";

		//check group visibility
		aFormContent.forEach(function(oControl) {
			if (oControl instanceof sap.ui.core.Title) {
				sTitleId = oControl.getId();
				oLocalRemovedGroups[sTitleId] = {
					oTitle: oControl,
					aChildren: []
				};
			} else {
				if (oLocalRemovedGroups[sTitleId]) {
					if (oControl.getVisible()) {
						delete oLocalRemovedGroups[sTitleId];
					} else {
						oLocalRemovedGroups[sTitleId].aChildren.push(oControl);
					}
				}
			}
		});

		//remove invisible groups from the form completely
		Object.keys(oLocalRemovedGroups).forEach(function(sTitleKey) {
			var oObject = oLocalRemovedGroups[sTitleKey];
			oForm.removeContent(oObject.oTitle).destroy();
			oObject.aChildren.forEach(function(oControl) {
				oForm.removeContent(oControl).destroy();
			});
		});
	};

	return PersInfoUtil;
});
