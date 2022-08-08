/*
 * Copyright (C) 2009-2020 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object",
	"sap/m/MessageBox"
], function (UI5Object, MessageBox) {
	"use strict";

	return UI5Object.extend("hcm.fab.mytimesheet.controller.ErrorHandler", {

		/**
		 * Handles application errors by automatically attaching to the model events and displaying errors when needed.
		 * @class
		 * @param {sap.ui.core.UIComponent} oComponent reference to the app's component
		 * @public
		 * @alias hcm.fab.mytimesheet.controller.ErrorHandler
		 */
		constructor: function (oComponent, oMessageProcessor, oMessageManager) {
			this._aErrors = [];
			this._showErrors = "immediately";
			this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
			this._oComponent = oComponent;
			this._oModel = oComponent.getModel();
			this._bMessageOpen = false;
			this._sErrorText = this._oResourceBundle.getText("errorText");
			this._messageManager = oMessageManager;
			this._messageProcessor = oMessageProcessor;

			this._oModel.attachMetadataFailed(function (oEvent) {
				var oParams = oEvent.getParameters();
				this._showServiceError(oParams.response);
			}, this);

			this._oModel.attachRequestFailed(function (oEvent) {
				var oParams = oEvent.getParameters();
				var response = oParams.response;
				var message = "";
				var description, additionalText;
				var messageType;
				if (response) {
					if (response.message) {
						description = response.message;
					}
					if (response.responseText) {
						var errorJSON;
						try {
							errorJSON = JSON.parse(response.responseText);
						} catch (e) {
							errorJSON = undefined;
							message = response.responseText;
						}
						if (errorJSON && errorJSON.error && errorJSON.error.message && errorJSON.error.message.value && errorJSON.error.innererror) {
							// Additional coding to handle Warning and Error message(s)
							// for (var len = 0; len < errorJSON.error.innererror.errordetails.length - 1; len++) {
							// 	if (messageType !== "error") {
							// 		messageType = errorJSON.error.innererror.errordetails[len].severity;
							// 	}
							// 	message += errorJSON.error.innererror.errordetails[len].message + "\n";
							// }
							// //if message type is error then add the last error message
							// if (messageType !== "error") {
							// 	if (!errorJSON.error.innererror.errordetails[len].code.match("/IWBEP")) {
							// 		messageType = errorJSON.error.innererror.errordetails[len].severity;
							// 	}
							// }
							// if (messageType === "error") {
							// 	message += errorJSON.error.innererror.errordetails[len].message;
							// }
							for (var len = 0; len < errorJSON.error.innererror.errordetails.length - 1; len++) {
								message += errorJSON.error.innererror.errordetails[len].message + "\n";
							}
							//if last error message is not the generic exception then add it to the messages list
							if (!errorJSON.error.innererror.errordetails[len].code.match("/IWBEP")) {
								message += errorJSON.error.innererror.errordetails[len].message;
							}
						}
					}
					if (response.statusText) {
						// additionalText = response.statusText;
					}
				}
				if (oParams.response.statusCode !== "404" || (oParams.response.statusCode === 404 && oParams.response.responseText.indexOf(
						"Cannot POST") === 0)) {
					this._sErrorText = message;
					var msgType = JSON.parse(oParams.response.responseText).error.innererror.errordetails[0].severity;
					this._showServiceError(message, msgType);
					// oMessageManager.addMessages(
					// 	new sap.ui.core.message.Message({
					// 		message: message,
					// 		description: description,
					// 		// additionalText: additionalText,
					// 		type: sap.ui.core.MessageType.Error,
					// 		processor: oMessageProcessor
					// 	})
					// );

				}
			}, this);
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when a service call has failed.
		 * Only the first error message will be display.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showServiceError: function (sDetails, msgType) {
			if (this._bMessageOpen) {
				return;
			}
			this._bMessageOpen = true;
			if (msgType == "warning") {
				MessageBox.warning(
					this._sErrorText, {
						id: "serviceErrorMessageBox",
						details: sDetails,
						styleClass: this._oComponent.getContentDensityClass(),
						actions: [MessageBox.Action.CLOSE],
						onClose: function () {
							this._bMessageOpen = false;
						}.bind(this)
					}
				);
			} else {
				MessageBox.error(
					this._sErrorText, {
						id: "serviceErrorMessageBox",
						details: sDetails,
						styleClass: this._oComponent.getContentDensityClass(),
						actions: [MessageBox.Action.CLOSE],
						onClose: function () {
							this._bMessageOpen = false;
						}.bind(this)
					}
				);
			}
		},
		// _showServiceWarning: function (sDetails) {
		// 	if (this._bMessageOpen) {
		// 		return;
		// 	}
		// 	this._bMessageOpen = true;
		// 	MessageBox.warning(
		// 		this._sErrorText, {
		// 			id: "serviceErrorMessageBox",
		// 			details: sDetails,
		// 			styleClass: this._oComponent.getContentDensityClass(),
		// 			actions: [MessageBox.Action.CLOSE],
		// 			onClose: function () {
		// 				this._bMessageOpen = false;
		// 			}.bind(this)
		// 		}
		// 	);
		// },
		processError: function (oError) {
			this._messageManager.removeAllMessages();
			var messageText = "";
			var messageType = "";
			var errorJSON = JSON.parse(oError.responseText);
			var totalLength = errorJSON.error.innererror.errordetails.length - 1;
			// Additional coding to handle error message(s)
			for (var len = 0; len < totalLength; len++) {
				messageText = errorJSON.error.innererror.errordetails[len].message;
				messageType = errorJSON.error.innererror.errordetails[len].severity;
				if (messageType == "warning") {
					this._messageManager.addMessages(
						new sap.ui.core.message.Message({
							message: messageText,
							description: messageText,
							type: sap.ui.core.MessageType.Warning,
							processor: this._messageProcessor
						})
					);
				} else {
					this._messageManager.addMessages(
						new sap.ui.core.message.Message({
							message: messageText,
							description: messageText,
							type: sap.ui.core.MessageType.Error,
							processor: this._messageProcessor
						})
					);
				}
			}
		}
	});
});