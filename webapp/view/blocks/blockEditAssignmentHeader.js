/*
 * Copyright (C) 2009-2020 SAP SE or an SAP affiliate company. All rights reserved.
 */
jQuery.sap.declare("hcm.fab.mytimesheet.view.blocks.blockEditAssignmentHeader");
jQuery.sap.require("sap.uxap.BlockBase");

sap.uxap.BlockBase.extend("hcm.fab.mytimesheet.view.blocks.blockEditAssignmentHeader", {
	metadata: {
		views: {
			Collapsed: {
				viewName: "hcm.fab.mytimesheet.view.blocks.blockEditAssignmentHeader",
				type: "XML"
			},
			Expanded: {
				viewName: "hcm.fab.mytimesheet.view.blocks.blockEditAssignmentHeader",
				type: "XML"
			}
		},
		properties: {
			"columnLayout": {
				type: "sap.uxap.BlockBaseColumnLayout",
				defaultValue: "2"
			}
		}
	}
});