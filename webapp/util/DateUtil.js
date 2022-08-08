/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object",
	"sap/ui/core/format/DateFormat",
	"sap/ui/core/LocaleData"
], function (UI5Object, DateFormat, LocaleData) {
	"use strict";

	var oConfiguration = sap.ui.getCore().getConfiguration();
	var sFormatLocal = oConfiguration.getFormatSettings().getFormatLocale();
	var oLocalData = LocaleData.getInstance(sFormatLocal);
	var oDateFormatterLong = DateFormat.getDateInstance({
		style: "long"
	});
	var oDateFormatterLongUTC = DateFormat.getDateInstance({
		style: "long",
		UTC: true
	});
	var oDateFormatterShortUTC = DateFormat.getDateInstance({  
		style: "short",
		UTC: true
	});	
	var oTimeFormatterShortUTC = DateFormat.getTimeInstance({
		style: "short",
		UTC: true
	});

	var DateUtil = UI5Object.extend("hcm.fab.lib.common.util.DateUtil", {});

	DateUtil.convertToFullDayUTC = function (oDate) {
		if (!oDate) {
			return oDate;
		}
		var _oDate = new Date(oDate.getUTCFullYear(), oDate.getUTCMonth(), oDate.getUTCDate());
		_oDate.setUTCMinutes(_oDate.getUTCMinutes() - oDate.getTimezoneOffset());
		return _oDate;
	};

	DateUtil.convertToFullDayLocal = function (oDate) {
		if (!oDate) {
			return oDate;
		}
		return new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
	};

	DateUtil.convertToLocal = function (oDate) {
		if (!oDate) {
			return oDate;
		}
		var _oDate = new Date(oDate.getTime());
		_oDate.setMinutes(_oDate.getMinutes() + oDate.getTimezoneOffset());
		return _oDate;
	};

	DateUtil.convertToUTC = function (oDate) {
		if (!oDate) {
			return oDate;
		}
		var _oDate = new Date(oDate.getTime());
		_oDate.setMinutes(_oDate.getMinutes() - oDate.getTimezoneOffset());
		return _oDate;
	};

	DateUtil.roundDateToFirstDayOfMonth = function (oDate) {
		var _date = new Date(oDate.getTime());
		_date.setUTCDate(1);
		return DateUtil.convertToFullDayUTC(_date);
	};

	DateUtil.roundDateToFirstDayOfWorkingWeek = function (oDate) {
		var _date = DateUtil.convertToFullDayUTC(oDate); //new Date(oDate.getTime());
		var diffDays = _date.getDay() - oLocalData.getFirstDayOfWeek();
		if (diffDays > 0) {
			_date.setDate(_date.getDate() - diffDays);
		} else if (diffDays < 0) {
			_date.setDate(_date.getDate() - (7 + diffDays));
		}
		return _date;
	};

	DateUtil.isSameDay = function (oDate1, oDate2) {
		return oDate1.getYear() === oDate2.getYear() && oDate1.getMonth() === oDate2.getMonth() && oDate1.getDate() === oDate2.getDate();
	};

	DateUtil.getIntervalPattern = function (sPattern) {
		return oLocalData.getIntervalPattern(sPattern);
	};

	DateUtil.formatDateLong = function (oDate) {
		return oDateFormatterLong.format(oDate);
	};
	
	DateUtil.formatDateLongUTC = function (oDate) {
		return oDateFormatterLongUTC.format(oDate);
	};
	
	DateUtil.formatDateShortUTC = function (oDate) {
		return oDateFormatterShortUTC.format(oDate);
	};

	DateUtil.formatTimeShortUTC = function (oDate) {
		return oTimeFormatterShortUTC.format(oDate);
	};

	DateUtil.formatDateRange = function (oStartDate, oEndDate) {
		// Format date range
		if (DateUtil.isSameDay(oStartDate, oEndDate)) {
			return DateUtil.formatDateLong(oStartDate);
		} else {
			var sDateRange = DateUtil.getIntervalPattern("d - d");
			sDateRange = sDateRange.replace("{0}", DateUtil.formatDateLong(oStartDate));
			sDateRange = sDateRange.replace("{1}", DateUtil.formatDateLong(oEndDate));
			return sDateRange;
		}
	};
	
	DateUtil.formatDateRangeUTC = function (oStartDate, oEndDate) {
		// Format date range UTC
		if (DateUtil.isSameDay(oStartDate, oEndDate)) {
			return DateUtil.formatDateLongUTC(oStartDate);
		} else {
			var sDateRange = DateUtil.getIntervalPattern("d - d");
			sDateRange = sDateRange.replace("{0}", DateUtil.formatDateLongUTC(oStartDate));
			sDateRange = sDateRange.replace("{1}", DateUtil.formatDateLongUTC(oEndDate));
			return sDateRange;
		}
	};
	
	DateUtil.formatDateRangeShortUTC = function (oStartDate, oEndDate) {
		// Format date range short UTC
		if (DateUtil.isSameDay(oStartDate, oEndDate)) {
			return DateUtil.formatDateShortUTC(oStartDate);
		} else {
			var sDateRange = DateUtil.getIntervalPattern("d - d");
			sDateRange = sDateRange.replace("{0}", DateUtil.formatDateShortUTC(oStartDate));
			sDateRange = sDateRange.replace("{1}", DateUtil.formatDateShortUTC(oEndDate));
			return sDateRange;
		}
	};	

	DateUtil.formatTimeRange = function (oStartTime, oEndTime) {
		if (oStartTime.ms !== 0 || oEndTime.ms !== 0) {
			if (oStartTime.ms === oEndTime.ms) {
				return DateUtil.formatTimeShortUTC(new Date(oStartTime.ms));
			} else {
				var sTimeRange = DateUtil.getIntervalPattern("t - t");
				sTimeRange = sTimeRange.replace("{0}", DateUtil.formatTimeShortUTC(new Date(oStartTime.ms)));
				sTimeRange = sTimeRange.replace("{1}", DateUtil.formatTimeShortUTC(new Date(oEndTime.ms)));
				return sTimeRange;
			}
		} else {
			return null;
		}
	};

	return DateUtil;
});
