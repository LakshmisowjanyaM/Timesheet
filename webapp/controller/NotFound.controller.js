/*
 * Copyright (C) 2009-2020 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
		"hcm/fab/mytimesheet/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("hcm.fab.mytimesheet.controller.NotFound", {

			/**
			 * Navigates to the worklist when the link is pressed
			 * @public
			 */
			onLinkPressed : function () {
				this.getRouter().navTo("worklist");
			}

		});

	}
);