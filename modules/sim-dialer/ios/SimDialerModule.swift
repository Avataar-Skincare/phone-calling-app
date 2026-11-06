import CallKit
import ExpoModulesCore
import UIKit

/// iOS half of `SimDialer`. The JS contract lives in `modules/sim-dialer/index.ts`; function names,
/// arguments and event payloads must match `android/.../SimDialerModule.kt` exactly.
///
/// iOS gives apps no way to place a call silently: `tel:` always shows the system "Call" prompt,
/// and the SIM is chosen by iOS. In return, CXCallObserver reports outgoing calls precisely:
/// dialing → connected (the other side answered) → ended. No permission is needed for either.
public class SimDialerModule: Module {
  private let observer = CXCallObserver()
  private var observerDelegate: CallObserverDelegate?

  public func definition() -> ModuleDefinition {
    Name("SimDialer")

    Events("callState")

    OnCreate {
      let delegate = CallObserverDelegate { [weak self] payload in
        self?.sendEvent("callState", payload)
      }
      self.observerDelegate = delegate
      self.observer.setDelegate(delegate, queue: DispatchQueue.main)
    }

    // iOS needs no permission to open tel: links or to observe calls.
    AsyncFunction("getPermissions") { () -> [String: Any] in
      Self.grantedResponse
    }

    AsyncFunction("requestPermissions") { () -> [String: Any] in
      Self.grantedResponse
    }

    AsyncFunction("capabilities") { () -> [String: Any] in
      ["platform": "ios", "canDirectDial": false, "canTrack": true, "canChooseSim": false, "canReadCallLog": false]
    }

    AsyncFunction("startTracking") { () -> Bool in
      true
    }

    /// "offhook" while any outgoing call is live, "idle" otherwise (same vocabulary as Android).
    AsyncFunction("getCallState") { () -> String in
      self.observer.calls.contains { $0.isOutgoing && !$0.hasEnded } ? "offhook" : "idle"
    }

    AsyncFunction("listSims") { () -> [[String: String]] in
      []
    }

    // iOS gives apps no call log. Talk time comes from CXCallObserver's hasConnected instead.
    AsyncFunction("lastCallFromLog") { (_: String, _: Double) -> [String: Double]? in
      nil
    }

    AsyncFunction("placeCall") { (number: String, _: String?, promise: Promise) in
      let allowed = CharacterSet(charactersIn: "+0123456789")
      let cleaned = String(number.unicodeScalars.filter { allowed.contains($0) })
      guard !cleaned.isEmpty, let url = URL(string: "tel:\(cleaned)") else {
        promise.reject("E_BAD_NUMBER", "This phone number can't be dialed.")
        return
      }
      DispatchQueue.main.async {
        UIApplication.shared.open(url, options: [:]) { opened in
          if opened {
            promise.resolve("dialer")
          } else {
            promise.reject("E_NO_DIALER", "This device can't place phone calls.")
          }
        }
      }
    }
  }

  private static let grantedResponse: [String: Any] = [
    "status": "granted",
    "granted": true,
    "canAskAgain": true,
    "expires": "never",
  ]
}

/// Forwards outgoing-call changes as `callState` events. Incoming calls are ignored.
final class CallObserverDelegate: NSObject, CXCallObserverDelegate {
  private let emit: ([String: Any]) -> Void

  init(emit: @escaping ([String: Any]) -> Void) {
    self.emit = emit
  }

  func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
    guard call.isOutgoing else { return }
    let state: String
    if call.hasEnded {
      state = "ended"
    } else if call.hasConnected {
      state = "connected"
    } else {
      state = "dialing"
    }
    emit([
      "state": state,
      "at": Date().timeIntervalSince1970 * 1000,
      "connected": call.hasConnected,
    ])
  }
}
