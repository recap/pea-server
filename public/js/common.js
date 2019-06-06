var isDebug = false;
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
var isChrome = (!!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime)) || (navigator.userAgent.toLowerCase().inexOf('chrome') != -1);

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
	  console.log("Browser Support WebRTC")
	  return true;
	} else {
	  console.log("This Browser Not Support WebRTC")
	  return false;
	}
}();


/* exported trace */

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
 function trace(arg) {
	 if (!isDebug) return;
     var now = (window.performance.now() / 1000).toFixed(3);
     console.log(now + ': ', arg);
 }

 function weblog(message, type) {
     if (type == undefined) {
         type = "info";
     }
     $('#log').append('[' + type + '] ' + message + '\n');
 }
