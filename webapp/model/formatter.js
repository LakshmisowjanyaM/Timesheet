/*
 * Copyright (C) 2009-2020 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], function () {
	"use strict";

	return {

		/**
		 * Rounds the number unit value to 2 digits
		 * @public
		 * @param {string} sValue the number string to be rounded
		 * @returns {string} sValue with 2 digits rounded
		 */
		numberUnit: function (sValue) {
			if (!sValue) {
				return "";
			}
			return parseFloat(sValue).toFixed(2);
		},
		numberUnitStepInput: function (sValue) {
			if (!sValue || isNaN(parseFloat(sValue))) {
				return 0;
			}
			return parseFloat(sValue).toFixed(2);
		},

		visibility: function (longtext, rejReason, isPhone) {

			if (longtext == 'X' || rejReason) {
				return true;
			} else {
				return false;
			}
		},
		enabled: function (longtext, rejReason, isPhone) {
			if (!sap.ui.Device.system.phone) {
				return true;
			}
			if (longtext == 'X' || rejReason) {
				return true;
			} else {
				return false;
			}
		},
		isFilterVisible: function (sval1, sval2) {
			if (sval1 === true || sval2 === true) {
				return false;
			}
			return true;
		},
		status: function (sValue) {
			this.oBundle = this.getModel("i18n").getResourceBundle();
			if (sValue == '10') {
				return this.oBundle.getText('InProcess');
			} else if (sValue == '20') {
				return this.oBundle.getText('Submitted');
			} else if (sValue == '30') {
				return this.oBundle.getText('Approved');
			} else if (sValue == '40') {
				return this.oBundle.getText('Rejected');
			} else if (sValue == '100') {
				return this.oBundle.getText('allStatus');
			} else if (sValue == '99') {
				return this.oBundle.getText('Approved');
			}

		},
		state: function (sValue) {
			if (sValue == '10') {
				return 'None';
			} else if (sValue == '20') {
				return 'None';
			} else if (sValue == '30') {
				return 'Success';
			} else if (sValue == '40') {
				return 'Error';
			}
		},
		dateString: function (sValue) {
			this.oFormatYyyymmdd = sap.ui.core.format.DateFormat.getInstance({
				pattern: "yyyy-MM-dd",
				calendarType: sap.ui.core.CalendarType.Gregorian
			});
			return String(this.oFormatYyyymmdd.format(sValue));
		},
		dateStringFormat: function (sValue) {
			this.oFormatYyyymmdd = sap.ui.core.format.DateFormat.getInstance({
				pattern: "EEEE, MMMM d",
				calendarType: sap.ui.core.CalendarType.Gregorian
			});
			return String(this.oFormatYyyymmdd.format(sValue));
		},
		setVTKENcheckbox: function (sValue) {
			if (sValue === 'X') {
				return true;
			}
			return false;
		},
		dateStringFormat2: function (sValue) {
			// var dateString = new Date(sValue.match(/\d+/)[0] * 1);
			this.oFormatddMMMyyyy = sap.ui.core.format.DateFormat.getInstance({
				pattern: "dd MMM, yyyy",
				calendarType: sap.ui.core.CalendarType.Gregorian
			});
			return String(this.oFormatddMMMyyyy.format(sValue));
		},
		dateStringFormat2View: function (sValue) {
			return new Date(sValue.match(/\d+/)[0] * 1);
		},
		hoursValidation: function (recorded, target) {
			if (parseInt(recorded) < parseInt(target)) {
				return "Warning";
			} else if (parseInt(recorded) == 0 && parseInt(target) == 0) {
				return "None";
			} else if (parseInt(recorded) >= parseInt(target)) {
				return "Success";
			}
		},
		concatAdHocStrings: function (recorded, target, updated) {
			var sum = parseFloat(recorded) + parseFloat(updated);
			return sum.toFixed(2) + ' / ' + target;
		},
		concatStrings: function (recorded, target) {
			return recorded + " / " + target;
		},
		infoEnabled: function (id, counter) {
			if (id !== "" || counter !== "") {
				return true;
			} else {
				return false;
			}
		},
		highlightListItem: function (highlight) {
			if (highlight === "Information") {
				return "Information";
			}
			return "None";
		},
		formatInfo: function (phone, edit) {
			if (phone) {
				return '';
			}
			if (edit) {
				return '5%';
			}

			return '';

		},
		ConcatenateText: function (value, attr) {
			// var retText;
			// return "Testing text";
			// var retText = "";
			// for(var i=0; i< this.displayAsAttribute.length; i++){
			//     if (value[this.displayAsAttribute[i]] !== undefined && value[this.displayAsAttribute[i]] !== ""){
			//         retText+= value[this.displayAsAttribute[i]] + ", ";
			//     }
			// }
			// retText = retText.substring(0, retText.length - 2);
			// return retText;
			var that = this;
			var retText = "",
				textFound, textModel, textValue, fieldCodeValue;
			for (var i = 0; i < this.displayAsAttribute.length; i++) {
				fieldCodeValue = value[this.displayAsAttribute[i].field];
				if (fieldCodeValue !== undefined && fieldCodeValue !== "") {
					textModel = this.getModel(this.displayAsAttribute[i].field);
					if (textModel) {
						textFound = $.grep(textModel.oData, function (element, ind) {
							return element.DispField1Id === fieldCodeValue;
						});
						if (textFound.length && textFound.length > 0) {
							retText += textFound[0].DispField1Val + ", ";
						} else {
							if (!that.fieldTextFetchedAsync[this.displayAsAttribute[i].field + '*!*' + value[this.displayAsAttribute[i].field]]) {
								that.getFieldTextAsync(this.displayAsAttribute[i].field, value[this.displayAsAttribute[i].field]).then(function (data) {
									that.getModel('OverviewAttributes').setProperty('/state', that.getModel('OverviewAttributes').getProperty('/state') ^ 1); //Changing state to call attribute formatter
								});
							}
							that.fieldTextFetchedAsync[this.displayAsAttribute[i].field + '*!*' + value[this.displayAsAttribute[i].field]] = 1; //If Async Texts have been fetched

							retText += value[this.displayAsAttribute[i].field] + ", ";
						}
					} else {
						retText += value[this.displayAsAttribute[i].field] + ", ";
					}
				}
			}
			retText = retText.substring(0, retText.length - 2);
			return retText;
		},
		ConcatenateTodoText: function (value, attr) {
			var that = this;
			var retText = "",
				textFound, textModel, textValue, fieldCodeValue;
			for (var i = 0; i < this.displayAsAttribute.length; i++) {
				fieldCodeValue = value[this.displayAsAttribute[i].field];
				if (fieldCodeValue !== undefined && fieldCodeValue !== "") {
					textModel = this.getModel(this.displayAsAttribute[i].field);
					if (textModel) {
						textFound = $.grep(textModel.oData, function (element, ind) {
							return element.DispField1Id === fieldCodeValue;
						});
						if (textFound.length && textFound.length > 0) {
							retText += textFound[0].DispField1Val + ", ";
						} else {
							if (!that.fieldTextFetchedAsync[this.displayAsAttribute[i].field + '*!*' + value[this.displayAsAttribute[i].field]]) {

								that.getFieldTextAsync(this.displayAsAttribute[i].field, value[this.displayAsAttribute[i].field]).then(function (data) {
									that.getModel('ToDoAttributes').setProperty('/state', that.getModel('ToDoAttributes').getProperty('/state') ^ 1); //Changing state to call attribute formatter
								});
							}
							that.fieldTextFetchedAsync[this.displayAsAttribute[i].field + '*!*' + value[this.displayAsAttribute[i].field]] = 1; //If Async Texts have been fetched
							retText += value[this.displayAsAttribute[i].field] + ", ";
						}
					} else {
						retText += value[this.displayAsAttribute[i].field] + ", ";
					}
				}
			}
			retText = retText.substring(0, retText.length - 2);
			return retText;
		},
		setAdHocCheckBox: function (fieldValue) {
			if (fieldValue === true || fieldValue === 'X') {
				return true;
			}
			return false;
		},

		mobconcatStrings: function (target, recorded) {
			this.oBundle = this.getModel("i18n").getResourceBundle();
			var oMissing = (parseFloat(target) - parseFloat(recorded)) > parseFloat(0) ? (parseFloat(target) - parseFloat(recorded)) : parseFloat(
				0);
			return this.oBundle.getText("mobMissingHours", [parseFloat(oMissing).toFixed(2)]);
		},
		concatDates: function (dateFrom, dateTo) {
			return dateFrom + "-" + dateTo;
		},
		formatToBackendString: function (oDate) {
			// if (typeof oDate !== "object") {
			//	oDate = new Date(oDate);
			// }
			// oDate = new Date(oDate + " UTC");

			// var year = oDate.getUTCFullYear();
			// var month = oDate.getUTCMonth() + 1;
			// var day = oDate.getUTCDate();
			// if (day < 10) {
			// 	day = '0' + day;
			// }
			// if (month < 10) {
			// 	month = '0' + month;
			// }
			// return year + '-' + month + '-' + day;
			var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyy-MM-dd"
			});
			oDate = dateFormat.format(new Date(oDate));
			return oDate;

		},
		TodoState: function (status) {
			if (status == "40") {
				return "Error";
			} else {
				return "None";
			}
		},
		switchVisibility: function (status) {
			if (status) {
				return true;
			} else {
				return false;
			}
		},
		switchState: function (oValue) {
			if (typeof oValue === 'boolean') {
				return oValue;
			} else {
				return false;
			}
		},
		returnEditedTaskValue: function (FieldName) {
			var data = this.getModel('EditedTask').getData();
			return data[FieldName];
		},
		longtextButtons: function (sValue) {
			if (sValue == 'X') {
				return "sap-icon://notification-2";
			} else {
				return "sap-icon://write-new-document";
			}
		},
		getItems: function (sValue) {
			if (sap.ui.Device.system.phone === true) {
				return "{path:'TimeData>/', sorter: { path: 'TimeEntryDataFields/WORKDATE', descending:false, group: true  }, groupHeaderFactory:'.getGroupHeader'}";
			} else {
				return "{path:'TimeData>/', sorter: { path: 'TimeEntryDataFields/WORKDATE', descending:false, group: false  }, groupHeaderFactory:'.getGroupHeader'}";
			}
		},
		activeTasks: function (status, valStart, valEnd, fields) {
			if (valEnd !== undefined)
				valEnd = valEnd.setHours(23, 59, 59);

			if ((status === "1") && (fields.WORKDATE >= valStart) && (fields.WORKDATE <= valEnd)) {
				//Active Assignment
				return true;
			} else if ((status === "1") && (valStart == undefined) && (valEnd == undefined)) {
				//Assignment Group
				return true;
			} else {
				//Inactive Assignment
				return false;
			}
		},
		dayOfWeek: function (sValue) {
			switch (sValue) {
			case "SUNDAY":
				return 0;
			case "MONDAY":
				return 1;
			case "TUESDAY":
				return 2;
			case "WEDNESDAY":
				return 3;
			case "THURSDAY":
				return 4;
			case "FRIDAY":
				return 5;
			case "SATURDAY":
				return 6;
			default:
				return 0;
			}
		},
		formatTableTimeStart: function (startTime, endTime) {
			var timeParser = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: "HHmm"
			});
			var timeFormatter = sap.ui.core.format.DateFormat.getTimeInstance({
				style: "short"
			});
			if (startTime === "000000" && endTime === "000000") {
				return "";
			}
			if (startTime === "000000") {
				var time = timeParser.parse("240000");
				time = timeFormatter.format(time);
				return time;
			}

			startTime = timeParser.parse(startTime);
			startTime = timeFormatter.format(startTime);
			return startTime;

		},
		formatTableTimeEnd: function (startTime, endTime) {
			var timeParser = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: "HHmm"
			});
			var timeFormatter = sap.ui.core.format.DateFormat.getTimeInstance({
				style: "short"
			});
			if (startTime === "000000" && endTime === "000000") {
				return "";
			}
			if (endTime === "000000") {
				var time = timeParser.parse("240000");
				time = timeFormatter.format(time);
				return time;
			}

			endTime = timeParser.parse(endTime);
			endTime = timeFormatter.format(endTime);
			return endTime;

		},

		formatStartReadOnlyTime: function (oTime, oEnd) {
			var timeParser = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: "HHmm"
			});
			var timeFormatter = sap.ui.core.format.DateFormat.getTimeInstance({
				style: "short"
			});
			if (oTime === "000000" && oEnd === "000000") {
				return "00:00";
			}

			if (oTime === "000000") {

				var time = timeParser.parse("240000");
				time = timeFormatter.format(time);
				return time;
			}

			oTime = timeParser.parse(oTime);
			oTime = timeFormatter.format(oTime);
			return oTime;
		},

		formatEndReadOnlyTime: function (oStart, oTime) {
			var timeParser = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: "HHmm"
			});
			var timeFormatter = sap.ui.core.format.DateFormat.getTimeInstance({
				style: "short"
			});
			if (oTime === "000000" && oStart === "000000") {
				return "00:00";
			}

			if (oTime === "000000") {
				var time = timeParser.parse("240000");
				time = timeFormatter.format(time);
				return time;
			}

			oTime = timeParser.parse(oTime);
			oTime = timeFormatter.format(oTime);
			return oTime;

		},

		formatTime: function (oTime) {
			var timeParser = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: "HHmm"
			});
			var timeFormatter = sap.ui.core.format.DateFormat.getTimeInstance({
				style: "short"
			});
			if (oTime === "000000") {
				return "00:00";
			}
			oTime = timeParser.parse(oTime);
			oTime = timeFormatter.format(oTime);
			return oTime;
		},
		convertTime: function (oTime) {
			var timeFormat = sap.ui.core.format.DateFormat
				.getTimeInstance({
					pattern: "HHmmss"
				});
			return timeFormat.format(oTime);
		},
		concatTimeStrings: function (startTime, endTime) {
			var timeParser = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: "HHmm"
			});
			var timeFormatter = sap.ui.core.format.DateFormat.getTimeInstance({
				style: "short"
			});
			startTime = timeParser.parse(startTime);
			startTime = timeFormatter.format(startTime);
			endTime = timeParser.parse(endTime);
			endTime = timeFormatter.format(endTime);
			if (startTime === endTime) {
				return "00:00" + " - " + "00:00";
			} else {
				return startTime + " - " + endTime;
			}

		},
		assignmentState: function (state) {
			if (state === true) {
				return sap.ui.core.ValueState.Success;
			} else {
				return sap.ui.core.ValueState.Error;
			}
		},
		assignmentName: function (oAssignment, oAssignmentId, Counter, Status) {
			if (oAssignmentId !== "" && parseFloat(oAssignmentId).toFixed(2) !== parseFloat("0.0000000").toFixed(2)) {
				return oAssignment;
			} else if (((oAssignmentId === "" || parseFloat(oAssignmentId).toFixed(2) === parseFloat("0.0000000").toFixed(2)) && Counter !== "")) {
				return this.oBundle.getText('noAssignment');
			} else if (Status == '99') {
				return this.oBundle.getText('hrRecord');
			}
		},
		getUnitTexts: function (key, hours) {
			if (this.getModel("UNIT")) {
				var data = this.getModel("UNIT").getData();
				var text;
				this.oBundle = this.getModel("i18n").getResourceBundle();
				if (key !== "" && key !== "H") {
					var obj = $.grep(data, function (element, index) {
						return element.DispField1Id === key;
					});
					if (obj.length > 0) {
						text = obj[0].DispField1Val;

					}
				} else {
					if (key === "H" && parseInt(hours) > 1) {
						text = this.oBundle.getText("hours");
					} else if (parseInt(hours) == 1) {
						text = this.oBundle.getText("hour");
					} else {
						text = this.oBundle.getText("hours");
					}
				}

				return text;
			}

		},
		formatText: function () {

		},
		assignmentstatus: function (status) {
			return status === true ? this.oBundle.getText('activeStatus') : this.oBundle.getText('inactiveStatus');
		},
		assignmentStatusGroup: function (status) {
			return status === "1" ? this.oBundle.getText('activeStatus') : this.oBundle.getText('inactiveStatus');
		},
		typeKind: function (oType) {
			switch (oType) {
			case "C":
				return sap.m.InputType.Text;
			case "N":
				return sap.m.InputType.Number;
			default:
				return sap.m.InputType.Text;
			}

		},
		fieldLength: function (oLength, oType) {
			if (oLength !== undefined && oLength !== null) {
				switch (oType) {
				case "C":
					return parseInt(oLength);
				case "N":
					return parseInt(oLength);
				case "D":
					return parseInt(oLength);
				default:
					return parseInt(oLength);
				}

			} else {
				return 0;
			}
		},
		checkVisible: function (checkVisible, adHocVisible) {
			if (adHocVisible) {
				return false;
			}
			if (checkVisible) {
				return true;
			}
			return false;
		},

		submitEnabled: function (submitVisible, adHocVisible) {
			if (adHocVisible) {
				return false;
			}
			if (submitVisible) {
				return true;
			}
			return false;
		},
		longtextAdHocButtons: function (sValue) {
			if (sValue) {
				return "sap-icon://notification-2";
			} else {
				return "sap-icon://write-new-document";

			}
		},
		draftTodoVisible: function (sValue, sFields) {
			if (sFields === 'DRAFT') {
				return false;
			}
			if (sValue === 'V') {
				return true;
			}
			return false;
		},
		getDraftSelected: function (value) {
			if (value === true) {
				return true;
			}
			return false;
		},
		getTexts: function (oFieldName, oFieldValue, oFieldValueText) {
			var oModel = this.getModel(oFieldName);
			var data;
			var text;
			if (oFieldName == 'RPROJ') {
				if (oModel) {
					data = oModel.getData();
					if (data) {
						text = $.grep(data, function (element, index) {
							return element.DispField1Id === oFieldValue;
						});
						if (text.length > 0) {
							return text[0].DispField1Val;
						} else {
							if (!oFieldValueText) {
								return oFieldValue;
							} else {
								return oFieldValueText;
							}
						}
					} else {
						if (!oFieldValueText) {
							return oFieldValue;
						} else {
							return oFieldValueText;
						}
					}
				} else {
					if (!oFieldValueText) {
						return oFieldValue;
					} else {
						return oFieldValueText;
					}
				}
			} else if (oFieldName === 'BEGUZ' || oFieldName == 'ENDUZ') {
				text = this.formatter.formatTime(oFieldValue);
				return text;
			} else if (oFieldName === 'VORNR') {
				if (oModel) {
					data = oModel.getData();
					if (data) {
						text = $.grep(data, function (element, index) {
							return element.DispField1Id === oFieldValue;
						});
						if (text.length > 0) {
							if (oFieldName === "APPROVER") {
								return text[0].DispField2Val;
							} else {
								return text[0].DispField3Val;
							}

						} else {
							return oFieldValue;
						}
					} else {
						return oFieldValue;
					}
				} else {
					return oFieldValue;
				}
			} else if (oFieldName === 'SEBELN' || oFieldName === 'SEBELP') {
				if (oModel) {
					data = oModel.getData();
					if (data) {
						text = $.grep(data, function (element, index) {
							return element.DispField1Id === oFieldValue;
						});
						if (text.length > 0) {
							if (oFieldName === "APPROVER") {
								return text[0].DispField2Val;
							} else {
								return text[0].DispField1Id;
							}

						} else {
							return oFieldValue;
						}
					} else {
						return oFieldValue;
					}
				} else {
					return oFieldValue;
				}
			} else {
				if (oModel) {
					data = oModel.getData();
					if (data) {
						text = $.grep(data, function (element, index) {
							return element.DispField1Id === oFieldValue;
						});
						if (text.length > 0) {
							if (oFieldName === "APPROVER") {
								return text[0].DispField2Val;
							} else {
								return text[0].DispField1Val;
							}

						} else {
							return oFieldValue;
						}
					} else {
						return oFieldValue;
					}
				} else {
					return oFieldValue;
				}
			}

		},

		getFormattedTexts: function (oFieldName, oFieldValue, oFieldValueText) {
			//Adding word-break property for wrapping of the text otherwise the 
			//overflow scroll bar would come destroying the view
			var oModel = this.getModel(oFieldName);
			var data;
			var text;
			if (oFieldName == 'RPROJ') {
				if (oModel) {
					data = oModel.getData();
					if (data) {
						text = $.grep(data, function (element, index) {
							return element.DispField1Id === oFieldValue;
						});
						if (text.length > 0) {
							return "<em style='overflow-wrap: break-word;'>" + text[0].DispField1Val + "</em>";
						} else {
							if (!oFieldValueText) {
								return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
							} else {
								return "<em style='overflow-wrap: break-word;'>" + oFieldValueText + "</em>";
							}
						}
					} else {
						if (!oFieldValueText) {
							return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
						} else {
							return "<em style='overflow-wrap: break-word;'>" + oFieldValueText + "</em>";
						}
					}
				} else {
					if (!oFieldValueText) {
						return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
					} else {
						return "<em style='overflow-wrap: break-word;'>" + oFieldValueText + "</em>";
					}
				}
			} else if (oFieldName == 'VORNR') {
				if (oModel) {
					data = oModel.getData();
					if (data) {
						text = $.grep(data, function (element, index) {
							return element.DispField1Id === oFieldValue;
						});
						if (text.length > 0) {
							if (oFieldName === "APPROVER") {
								return "<em style='overflow-wrap: break-word;'>" + text[0].DispField2Val + "</em>";
							} else {
								return "<em style='overflow-wrap: break-word;'>" + text[0].DispField3Val + "</em>";
							}

						} else {
							return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
						}
					} else {
						return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
					}
				} else {
					return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
				}
			} else if (oFieldName == 'SEBELN' || oFieldName == 'SEBELP') {
				if (oModel) {
					data = oModel.getData();
					if (data) {
						text = $.grep(data, function (element, index) {
							return element.DispField1Id === oFieldValue;
						});
						if (text.length > 0) {
							if (oFieldName === "APPROVER") {
								return "<em style='overflow-wrap: break-word;'>" + text[0].DispField2Val + "</em>";
							} else {
								return "<em style='overflow-wrap: break-word;'>" + text[0].DispField1Id + "</em>";
							}

						} else {
							return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
						}
					} else {
						return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
					}
				} else {
					return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
				}
			} else {
				if (oModel) {
					data = oModel.getData();
					if (data) {
						text = $.grep(data, function (element, index) {
							return element.DispField1Id === oFieldValue;
						});
						if (text.length > 0) {
							if (oFieldName === "APPROVER") {
								return "<em style='overflow-wrap: break-word;'>" + text[0].DispField2Val + "</em>";
							} else {
								return "<em style='overflow-wrap: break-word;'>" + text[0].DispField1Val + "</em>";
							}

						} else {
							return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
						}
					} else {
						return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
					}
				} else {
					return "<em style='overflow-wrap: break-word;'>" + oFieldValue + "</em>";
				}
			}

		},

		isSelected: function (status) {
			var a = status;
			return status;
		},
		calHoursQuanAmount: function (catsHours, catsQuantity, catsAmount) {
			var numberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
				maxFractionDigits: 2
			});
			var numberFormatQuan = sap.ui.core.format.NumberFormat.getFloatInstance({
				maxFractionDigits: 3
			});
			if (parseFloat(catsHours).toFixed(2) === parseFloat("0.00").toFixed(2) && parseFloat(catsQuantity).toFixed(2) === parseFloat("0.00").toFixed(
					2) && parseFloat(catsAmount).toFixed(2) === parseFloat("0.00").toFixed(2)) {
				return numberFormat.format(catsHours);
			} else if (parseFloat(catsHours).toFixed(2) !== parseFloat("0.00").toFixed(2) && parseFloat(catsQuantity).toFixed(2) === parseFloat(
					"0.00").toFixed(
					2) && parseFloat(catsAmount).toFixed(2) === parseFloat("0.00").toFixed(2)) {
				return numberFormat.format(catsHours);
			} else if (parseFloat(catsHours).toFixed(2) === parseFloat("0.00").toFixed(2) && parseFloat(catsQuantity).toFixed(2) !== parseFloat(
					"0.00").toFixed(
					2) && parseFloat(catsAmount).toFixed(2) === parseFloat("0.00").toFixed(2)) {
				return numberFormatQuan.format(catsQuantity);
			} else if (parseFloat(catsHours).toFixed(2) === parseFloat("0.00").toFixed(2) && parseFloat(catsQuantity).toFixed(2) === parseFloat(
					"0.00").toFixed(
					2) && parseFloat(catsAmount).toFixed(2) === parseFloat("0.00").toFixed(2)) {
				return numberFormat.format(catsAmount);
			} else if (parseFloat(catsHours).toFixed(2) !== parseFloat("0.00").toFixed(2) && parseFloat(catsQuantity).toFixed(2) !== parseFloat(
					"0.00").toFixed(
					2) && parseFloat(catsAmount).toFixed(2) === parseFloat("0.00").toFixed(2)) {
				return numberFormat.format(catsHours);
			} else if (parseFloat(catsHours).toFixed(2) === parseFloat("0.00").toFixed(2) && parseFloat(catsQuantity).toFixed(2) !== parseFloat(
					"0.00").toFixed(
					2) && parseFloat(catsAmount).toFixed(2) !== parseFloat("0.00").toFixed(2)) {
				return numberFormat.format(catsAmount);
			} else if (parseFloat(catsHours).toFixed(2) !== parseFloat("0.00").toFixed(2) && parseFloat(catsQuantity).toFixed(2) === parseFloat(
					"0.00").toFixed(
					2) && parseFloat(catsAmount).toFixed(2) !== parseFloat("0.00").toFixed(2)) {
				return numberFormat.format(catsHours);
			} else {
				return numberFormat.format(catsHours);
			}

		},
		calHoursQuanAmountInput: function (catsHours, catsQuantity, catsAmount) {
			// var numberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
			// 	maxFractionDigits: 2
			// });
			// var numberFormatQuan = sap.ui.core.format.NumberFormat.getFloatInstance({
			// 	maxFractionDigits: 3
			// });
			var catsHours = parseFloat(catsHours).toFixed(2);
			var catsAmount = parseFloat(catsAmount).toFixed(2);
			var catsQuantity = parseFloat(catsQuantity).toFixed(2);
			var zero = parseFloat("0.00").toFixed(2);
			if (catsHours === zero && catsQuantity === parseFloat("0.00").toFixed(
					2) && parseFloat(catsAmount).toFixed(2) === zero) {
				return catsHours;
			} else if (parseFloat(catsHours).toFixed(2) !== zero && parseFloat(catsQuantity).toFixed(2) === zero &&
				parseFloat(catsAmount).toFixed(2) === zero) {
				return catsHours;
			} else if (parseFloat(catsHours).toFixed(2) === zero && parseFloat(catsQuantity).toFixed(2) !== zero &&
				parseFloat(catsAmount).toFixed(2) === zero) {
				return catsHours;
			} else if (parseFloat(catsHours).toFixed(2) === zero && parseFloat(catsQuantity).toFixed(2) === zero &&
				parseFloat(catsAmount).toFixed(2) === zero) {
				return catsAmount;
			} else if (parseFloat(catsHours).toFixed(2) !== zero && parseFloat(catsQuantity).toFixed(2) !== zero &&
				parseFloat(catsAmount).toFixed(2) === zero) {
				return catsHours;
			} else if (parseFloat(catsHours).toFixed(2) === zero && parseFloat(catsQuantity).toFixed(2) !== zero &&
				parseFloat(catsAmount).toFixed(2) !== zero) {
				return catsAmount;
			} else if (parseFloat(catsHours).toFixed(2) !== zero && parseFloat(catsQuantity).toFixed(2) === zero &&
				parseFloat(catsAmount).toFixed(2) !== zero) {
				return catsHours;
			} else {
				return catsHours;
			}

		},
		commentDisplay: function (longtext, rejReason) {
			var dispText;
			this.oBundle = this.getModel("i18n").getResourceBundle();
			if (longtext) {
				dispText = longtext;
			}
			if (rejReason) {
				if (dispText !== undefined) {
					dispText = dispText + "\n\n" + this.oBundle.getText("rejReason") + ":\n" + rejReason;
				} else {
					dispText = this.oBundle.getText("rejReason") + ":\n" + rejReason;
				}
			}
			return dispText;
		},
		checkHrRecord: function (status, hoursDisabled) {
			if (status == '99') {
				return false;
			} else {
				if (hoursDisabled) {
					return false;
				} else {
					return true;
				}

			}
		},
		projectsVisible: function (cpr_guid, cpr_objguid) {
			if (cpr_guid === "" && cpr_objguid === "") {
				return false;
			} else {
				return true;
			}

		},
		isDate: function (value, type) {
			if (type === 'D') {
				return value;
			} else {
				return null;
			}
		},
		getRequiredField: function (isReadOnly, defaultValue, required) {
			if (isReadOnly === 'TRUE') {
				return false;
			}

			return required === 'X' ? true : false;

		},
		getUTCDate: function (date) {
			return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

		},
		checkPrevDay: function (vtkenFlag) {
			if (vtkenFlag === 'X') {
				return true;
			}
			return false;

		},
		getPlaceHolder: function (status, AssignmentName, targetHours, AssignmentId, ApprovedLeave, assignmentSelection, noAssignment) {

			if (status === "99") {

				if (AssignmentId !== "") {
					try {

						this.getSelectedKey();
						this.setValue(AssignmentName);

					} catch (exception) {

					}
					return AssignmentName;
				}
				try {

					this.getSelectedKey();
					this.setValue(ApprovedLeave);

				} catch (exception) {

				}
				return ApprovedLeave;
			}
			if (status === "199") {
				return AssignmentName;
			}

			if (status === "") {
				return assignmentSelection;
			} else {
				if (AssignmentName !== undefined) {
					if (AssignmentId && AssignmentName === "" || AssignmentName.toLowerCase() === "none") {
						return noAssignment;
					}
					if (this.getSelectedKey() === "") {
						return assignmentSelection;
					} else {
						return AssignmentName;
					}
				}
			}
			return assignmentSelection;
		},
		formatEntries: function (amount, unit, starttime, endtime) {
			this.oBundle = this.getModel("i18n").getResourceBundle();
			if (unit === "H") {
				var r = parseFloat(amount, 10).toFixed(2);
				r = r + " " + this.oBundle.getText("hours");
				if (starttime !== "000000" && endtime !== "000000") {
					r = r + " (" + this.formatter.formatTime(starttime) + " - " + this.formatter.formatTime(endtime) + ")";
				}
				return r;
			} else {
				var ret = parseFloat(amount, 10).toFixed(2);
				ret = ret + " " + unit;
				return ret;
			}
		},
		getTooltip: function (assignmentId) {
			var oData = this.getModel("TasksWithGroups").getData();
			oData = $.grep(oData, function (data) {
				if (data.AssignmentId === assignmentId) {
					return true;
				}
				return false;
			});
			if (oData.length >= 1) {
				return oData[0].AssignmentName;
			}
			return "";

		},
		getFilterVisibilty: function (isDuplicateWeekVisible, isPhone, isDailyView) {
			if (isDuplicateWeekVisible || isPhone || isDailyView) {
				return false;
			}

			return true;
		},
		duplicateData: function (oValue, oScreen) {
			if (!oScreen) {
				return oValue;
			} else {
				return false;
			}
		},

		switchStateText: function (state) {
			this.oBundle = this.getModel("i18n").getResourceBundle();
			if (state == true) {
				return this.oBundle.getText("statusSwitchTextInactive");
			} else {
				return this.oBundle.getText("statusSwitchTextActive");
			}
		},

		getPercentHours: function (totalHours, targetHours) {
			//Calculates the percentage value for the progress indicator
			if (parseFloat(targetHours) === 0) {
				return 100;
			}

			if (parseFloat(totalHours) === 0) {
				return 0;
			}
			if (parseFloat(totalHours) > parseFloat(targetHours)) {
				return 100.0;
			}
			return (parseFloat(totalHours) / parseFloat(targetHours)) * 100.0;

		},
		getHoursText: function (totalHours, targetHours) {
			return parseFloat(totalHours) + " / " + parseFloat(targetHours);
		},
		progressVisible: function (duplicateScreen, totalTarget, fixed) {
			if (fixed === true) {
				return false;
			}
			if (!totalTarget) {
				return false;
			}
			return !duplicateScreen;
		},
		progressFixedVisible: function (duplicateScreen, totalTarget, fixed, isPhone) {
			if (isPhone === true) {
				return false;
			}
			if (fixed === false) {
				return false;
			}
			if (!totalTarget) {
				return false;
			}
			return !duplicateScreen;

		},
		footerVisible: function (phoneView, dailyView, totalTarget) {
			if (phoneView || dailyView || !totalTarget) {
				return false;
			}
			return true;
		},
		getDuplicatetTaskEnabled: function (status) {
			if (status == "99") {
				return false;
			} else {
				return true;
			}

		},
		formatDuplicateText: function (text, isPhone) {
			if (isPhone) {
				return "<h4 style = 'margin-left:5%;'>" + text + "</h4>";
			}
			return "<h4>" + text + "</h4>";
		},
		getSelectedDates: function (text) {
			return "<h4>" + text + ':' + "</h4>";
		},
		getAdHocHeaderText: function (text, date) {
			return " " + "<h2> " + date + "</h2>";
		},
		getTotalRecordedText: function (recorded, target, text) {
			if (recorded && target) {
				return "<h4>" + text + ":" + recorded + " / " + target + "</h4>";
			} else {
				return "<h4>" + text + ":" + "</h4>";
			}
		},
		getAdHocVisible: function (currentAdHoc, formEntryVisible) {
			if (formEntryVisible === false) {
				return false;
			}
			return currentAdHoc;
		},

		convertAssignmentTime: function (oTime) {
			var timeParser = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: "HHmm"
			});
			var timeFormat = sap.ui.core.format.DateFormat
				.getTimeInstance({
					pattern: "HHmmss"
				});
			oTime = timeParser.parse(oTime);
			oTime = timeFormat.format(oTime);
			return oTime;
		},
		getValueFormatTimePicker: function () {
			return sap.ui.core.format.DateFormat.getTimeInstance({
				style: "short"
			}).oFormatOptions.pattern;
		},
		isTabletOrPhone: function (isTablet, isDesktop, isPhone) {
			if (isPhone) {
				return true;
			}
			if (isTablet && !isDesktop) {
				return true;
			} else {
				return false;
			}

		},
		isDesktop: function (isTablet, isDesktop, isPhone) {
			if (isPhone) {
				return false;
			}
			if (isTablet && !isDesktop) {
				return false;
			} else {
				return true;
			}

		},
		getStateText: function (totalHours, targetHours) {
			if (parseFloat(totalHours) === parseFloat(targetHours)) //Green Color
			{
				return "Success";
			}
			if (parseFloat(totalHours) > parseFloat(targetHours)) //Orange Color
			{
				return "Warning";
			}
			if (parseFloat(targetHours) === 0) //Whole weak is holiday
			{
				return "Warning";
			}
			var percent = (parseFloat(totalHours) / parseFloat(targetHours)) * 100.0;
			if (percent < 100.0) //Less than 100% black color
			{
				return "None";
			} else {
				return "Warning";
			}
		},
		isEnterButtonFooterEnabled: function (editScreen, isPhone) {
			if (editScreen && isPhone) {
				return true;
			} else {
				return false;
			}
		},
		getColumnVisible: function (visibility, isPhone) {
			if (visibility === false) {
				return false;
			}
			return true;
		},
		getMinScreenDevice: function (visibility, isPhone) {
			if (visibility === false && isPhone === true) {
				return "Phone";
			}
			return "Desktop";
		},
		getMinScreenDeviceTodo: function (visibility, isPhone) {
			if (visibility === true && isPhone === true) {
				return "Phone";
			}
			return "Desktop";
		},
		formatObjectPageTitle: function (i18nTextWithPernr, i18nTextWithoutPernr, positionText, positionId, employeeNumber, showEmployeeNumber,
			showEmployeeNumberWithoutZeros) {
			if (showEmployeeNumber) {
				var empNumber = showEmployeeNumberWithoutZeros ? employeeNumber : ("00000000" + employeeNumber).slice(-8);
				return jQuery.sap.formatMessage(i18nTextWithPernr, [positionText, positionId, empNumber]);
			} else {
				return jQuery.sap.formatMessage(i18nTextWithoutPernr, [positionText, positionId]);
			}
		}

	};

});