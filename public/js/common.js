var isDebug = true;
// Opera 8.0+
var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;

// Firefox 1.0+
var isFirefox = typeof InstallTrigger !== 'undefined';

// Safari 3.0+ "[object HTMLElementConstructor]" 
var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification));

// Internet Explorer 6-11
var isIE = /*@cc_on!@*/false || !!document.documentMode;

// Edge 20+
var isEdge = !isIE && !!window.StyleMedia;

// Chrome 1 - 71
var isChrome = (!!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime)) || (navigator.userAgent.toLowerCase().indexOf('chrome') != -1);

// Blink engine detection
var isBlink = (isChrome || isOpera) && !!window.CSS;

var isWebRTC = function() {
	var prefix;
	var version;
	if (window.mozRTCPeerConnection || navigator.mozGetUserMedia) {
	  prefix = 'moz';
	  version = parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);
	} else if (window.webkitRTCPeerConnection || navigator.webkitGetUserMedia) {
	  prefix = 'webkit';
	  version = navigator.userAgent.match(/Chrom(e|ium)/) && parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);
	}

	if(prefix == 'moz' || prefix == 'webkit' && version > 41){
	  trace("Browser Support WebRTC")
	  return true;
	} else {
	  trace("This Browser Not Support WebRTC")
	  return false;
	}
}();



 String.prototype.hashCode = function() {
     var hash = 0;
     if (this.length == 0) return hash;
     for (var i = 0; i < this.length; i++) {
         var character = this.charCodeAt(i);
         hash = ((hash << 5) - hash) + character;
         hash = hash & hash; // Convert to 32bit integer
     }
     return hash;
 }

// Logging utility function.
function trace(s) {
	if (!isDebug) {
		return;
	}
	var now = (window.performance.now() / 1000).toFixed(3);
	console.log(now + ': ', s);
}

function weblog(message, type) {
	if (type == undefined) {
		type = "info";
	}
	$('#log').append('[' + type + '] ' + message + '\n');
}

jQuery.fn.selectText = function(){
   var doc = document;
   var element = this[0];
   if (doc.body.createTextRange) {
	   var range = document.body.createTextRange();
	   range.moveToElementText(element);
	   range.select();
   } else if (window.getSelection) {
	   var selection = window.getSelection();        
	   var range = document.createRange();
	   range.selectNodeContents(element);
	   selection.removeAllRanges();
	   selection.addRange(range);
   }
};	

/*
 * Helper function to get file size.
 */
function getSizeUnits(size) {
		var units = null;
		var s = size;
		if (s < 1024) {
			units = 'B'
		}
		if ((s < 1024*1024) && (!units)){
			s = Math.round(s /1024)
			units = 'KB'
		}
		if ((s < 1024*1024*1024) && (!units)) {
			s = Math.round(s /(1024*1024))
			units = 'MB'
		}
		if ((s < 1024*1024*1024*1024) && (!units)) {
			s = Math.round(s /(1024*1024*1024))
			units = 'GB'
		}

	return {
		size: s,
		units: units
	}
}
