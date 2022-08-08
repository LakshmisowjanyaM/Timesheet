/*
 * Copyright (C) 2009-2020 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(['sap/uxap/BlockBase', 'hcm/fab/mytimesheet/model/formatter'],
	function (BlockBase, formatter) {
		"use strict";

		var HeaderDisplayTask = BlockBase.extend("hcm.fab.mytimesheet.view.blocks.HeaderDisplayTask", {
			metadata: {
				views: {
					Collapsed: {
						viewName: "hcm.fab.mytimesheet.view.blocks.HeaderDisplayTask",
						type: "XML"
					},
					Expanded: {
						viewName: "hcm.fab.mytimesheet.view.blocks.HeaderDisplayTask",
						type: "XML"
					}
				},
				properties: {
					"columnLayout": {
						type: "sap.uxap.BlockBaseColumnLayout",
						group: "Behavior",
						defaultValue: "2"
					}
				}
			}
		});

		return HeaderDisplayTask;

	});