/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/m/MessageBox",
	"sap/ui/base/Object"
], function(MessageBox, UI5Object) {
	"use strict";

	function fnExtractErrorContentFromResponse(sResponse) {
		var errorJSON,
			oError = {
				sMessage: sResponse,
				sDetails: null,
				aInnerErrors: []
			};

		try {
			// try to parse error as JSON-object first
			errorJSON = JSON.parse(sResponse);

			if (errorJSON && errorJSON.error) {
				if (errorJSON.error.message && errorJSON.error.message.value) {
					oError.sMessage = errorJSON.error.message.value;
				}
				if (errorJSON.error.code) {
					oError.sDetails = errorJSON.error.code;
				}
				if (errorJSON.error.innererror && errorJSON.error.innererror.errordetails) {
					oError.aInnerErrors = errorJSON.error.innererror.errordetails;
				}
			}

		} catch (e) {
			// xml is parsed using jQuery
			try {
				var xmlDoc = jQuery.parseXML(sResponse);
				oError.sMessage = xmlDoc.getElementsByTagName("message")[0].childNodes[0].nodeValue || xmlDoc.documentElement;
				oError.sDetails = xmlDoc.getElementsByTagName("code")[0].childNodes[0].nodeValue;
				oError.aInnerErrors = xmlDoc.getElementsByTagName("errordetail");
			} catch (f) {
				jQuery.sap.log.error(f);
				// Just in case that the Error from request could not be parsed
				oError.sMessage = sResponse;
			}
		}
		return oError;
	}

	function fnParseError(oEvent) {
		var oParameters = null,
			oResponse = null;

		// "getParameters": for the case of catching oDataModel "requestFailed" event
		oParameters = oEvent.getParameters ? oEvent.getParameters() : null;
		// "oParameters.response": V2 interface, response object is under the getParameters()
		// "oParameters": V1 interface, response is directly in the getParameters()
		// "oEvent" for the case of catching request "onError" event
		oResponse = oParameters ? (oParameters.response || oParameters) : oEvent;
		var responseContent = oResponse.responseText || oResponse.body || (oResponse.response && oResponse.response.body) || ""; //"onError" Event: V1 uses response and response.body
		return fnExtractErrorContentFromResponse(responseContent);
	}
	// -----------------------------	

	return UI5Object.extend("hcm.fab.lib.common.util.ErrorHandler", {

		/**
		 * Handles application errors by automatically attaching to the model events and displaying errors when needed.
		 * @class
		 * @param {sap.ui.core.UIComponent} oComponent reference to the app's component
		 * @public
		 * @alias sap.hcm.controller.ErrorHandler
		 */
		constructor: function(oModel, oI18NModel) {
			//this._oResourceBundle = sap.ui.getCore().getLibraryResourceBundle("hcm.fab.lib.common");
			this._oModel = oModel; //CommonModelManager.getModel();
			this._bMessageOpen = false;
			this._sErrorText = oI18NModel.getProperty("errorTitle");

			this._oModel.attachMetadataFailed(function(oEvent) {
				var oParams = oEvent.getParameters();
				this._showMetadataError(oParams.response);
			}, this);

			this._oModel.attachRequestFailed(function(oEvent) {
//				debugger;
				var oError = fnParseError(oEvent);

				// deal with main error message from response
//				if (this._showErrors === "immediately") {
					this._showServiceError(oError.sMessage, oError.sDetails);
/*				} else {
					jQuery.sap.log.error("OData response error: " + oError.sMessage, oError.sDetails);
					this._aErrors.push(oError.sMessage);
				}*/
/*				var oParams = oEvent.getParameters();

				// An entity that was not found in the service is also throwing a 404 error in oData.
				// We already cover this case with a notFound target so we skip it here.
				// A request that cannot be sent to the server is a technical error that we have to handle though
				if (oParams.response.statusCode !== "404" || (oParams.response.statusCode === 404 && oParams.response.responseText.indexOf(
						"Cannot POST") === 0)) {
					this._showServiceError(oParams.response);
				}*/
			}, this);
		},

		/**
		 * Shows a {@link sap.m.MessageBox}.
		 * @param {object} oEvent an event containing the response data, {function} a function that is executed on closing the MessageBox
		 * @public
		 */
		showErrorMsg: function(oEvent, fnOnClose) {
			var oErrorDetails = fnParseError(oEvent);
			MessageBox.error(oErrorDetails.sMessage, {
				details: oErrorDetails.sDetails,
				actions: MessageBox.Action.CLOSE,
				onClose: fnOnClose
			});
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when the metadata call has failed.
		 * The user can try to refresh the metadata.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showMetadataError: function(sDetails) {
			MessageBox.error(
				this._sErrorText, {
					details: sDetails,
					actions: [MessageBox.Action.RETRY, MessageBox.Action.CLOSE],
					onClose: function(sAction) {
						if (sAction === MessageBox.Action.RETRY) {
							this._oModel.refreshMetadata();
						}
					}.bind(this)
				}
			);
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when a service call has failed.
		 * Only the first error message will be display.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showServiceError: function(sErrorText, sErrorDetails, sTitleText) {
			if (this._bMessageOpen) {
				return;
			}
			this._bMessageOpen = true;
			MessageBox.error(sErrorText, {
				title: sTitleText ? sTitleText : this._sErrorText,
				details: sErrorDetails,
//				styleClass: this._oComponent.getContentDensityClass(),
				actions: [MessageBox.Action.CLOSE],
				onClose: function() {
					this._bMessageOpen = false;
				}.bind(this)
			});
		}
	});
});
