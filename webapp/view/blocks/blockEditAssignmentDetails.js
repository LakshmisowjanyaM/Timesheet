/*
 * Copyright (C) 2009-2020 SAP SE or an SAP affiliate company. All rights reserved.
 */
jQuery.sap.declare("hcm.fab.mytimesheet.view.blocks.blockEditAssignmentDetails");
jQuery.sap.require("sap.uxap.BlockBase");

sap.uxap.BlockBase.extend("hcm.fab.mytimesheet.view.blocks.blockEditAssignmentDetails", {
	metadata: {
		views: {
			Collapsed: {
				viewName: "hcm.fab.mytimesheet.view.blocks.blockEditAssignmentDetails",
				type: "XML"
			},
			Expanded: {
				viewName: "hcm.fab.mytimesheet.view.blocks.blockEditAssignmentDetails",
				type: "XML"
			}
		},
		properties: {
			"columnLayout": {
				type: "sap.uxap.BlockBaseColumnLayout",
				defaultValue: "4"
			}
		}
	}
});