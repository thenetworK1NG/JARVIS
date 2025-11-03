function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
import { flatten } from 'lodash-es';
import { SpeechSynthesis } from "../const/polyfill";
import voiceLocale from "../data/locales";
import speechSynthesisVoiceList from "./voiceList";
var genSpeechSynthesisVoiceList = function genSpeechSynthesisVoiceList() {
  if (!SpeechSynthesis) return speechSynthesisVoiceList;
  var data = SpeechSynthesis === null || SpeechSynthesis === void 0 ? void 0 : SpeechSynthesis.getVoices();
  if (!data) return speechSynthesisVoiceList;
  var localeKeys = Object.keys(voiceLocale);
  var list = {};
  var _iterator = _createForOfIteratorHelper(data),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var voice = _step.value;
      if (localeKeys.includes(voice.lang)) {
        if (!list[voice.lang]) list[voice.lang] = [];
        list[voice.lang].push(voice.name);
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  return Object.keys(list).length > 0 ? list : speechSynthesisVoiceList;
};
export var getSpeechSynthesisVoiceOptions = function getSpeechSynthesisVoiceOptions(locale) {
  var voiceList = genSpeechSynthesisVoiceList();
  var data = locale && voiceList !== null && voiceList !== void 0 && voiceList[locale] ? (voiceList === null || voiceList === void 0 ? void 0 : voiceList[locale]) || [] : flatten(Object.values(voiceList));
  return data.map(function (voice) {
    return {
      label: voice,
      value: voice
    };
  });
};