import UIKit
import Capacitor

/*
 Native Tab-Leiste für Lever – echte UITabBar, unter iOS 26 automatisch im Liquid-Glass-Look.

 Die App hat genau eine Web-Oberfläche (CAPBridgeViewController). Jeder Tab ist ein leerer
 „Platz“; beim Wechsel wandert die Web-Ansicht in den gewählten Platz (ohne Neuladen) und die
 Web-App schaltet über das Ereignis „select“ ihren Bereich um. Gesteuert wird alles aus
 src/client/native.ts – im Browser zeigt die Web-App weiter ihre eigene Leiste.
*/

final class LeverTabController: UITabBarController, UITabBarControllerDelegate {
    let bridgeVC: CAPBridgeViewController
    private var ids: [String] = []
    var onSelect: ((String) -> Void)?

    private static let ink = UIColor(red: 16 / 255, green: 16 / 255, blue: 16 / 255, alpha: 1)
    private static let volt = UIColor(red: 212 / 255, green: 255 / 255, blue: 58 / 255, alpha: 1)

    init(bridge: CAPBridgeViewController) {
        bridgeVC = bridge
        super.init(nibName: nil, bundle: nil)
        delegate = self
        view.backgroundColor = Self.ink
        tabBar.tintColor = Self.volt
        // Bis die Web-App die Tabs meldet: ein Platz, Leiste versteckt
        let slot = makeSlot()
        viewControllers = [slot]
        embed(in: slot)
        if #available(iOS 18.0, *) { setTabBarHidden(true, animated: false) } else { tabBar.isHidden = true }
    }

    required init?(coder: NSCoder) { fatalError("nicht aus Storyboard") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    private func makeSlot() -> UIViewController {
        let vc = UIViewController()
        vc.view.backgroundColor = Self.ink
        return vc
    }

    /// Web-Ansicht in einen Platz hängen (bleibt dieselbe Instanz, kein Neuladen)
    private func embed(in slot: UIViewController) {
        if bridgeVC.parent === slot { return }
        bridgeVC.willMove(toParent: nil)
        bridgeVC.view.removeFromSuperview()
        bridgeVC.removeFromParent()
        slot.addChild(bridgeVC)
        bridgeVC.view.frame = slot.view.bounds
        bridgeVC.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        slot.view.addSubview(bridgeVC.view)
        bridgeVC.didMove(toParent: slot)
    }

    func configure(items: [(id: String, title: String, symbol: String)], selected: String) {
        ids = items.map { $0.id }
        let slots = items.map { item -> UIViewController in
            let vc = makeSlot()
            vc.tabBarItem = UITabBarItem(title: item.title, image: UIImage(systemName: item.symbol), selectedImage: nil)
            return vc
        }
        setViewControllers(slots, animated: false)
        select(id: selected)
        setHidden(false, animated: false)
    }

    func select(id: String) {
        guard let i = ids.firstIndex(of: id), let vcs = viewControllers, i < vcs.count else { return }
        selectedIndex = i
        embed(in: vcs[i])
    }

    func setHidden(_ hidden: Bool, animated: Bool) {
        if !hidden { tabBar.isHidden = false }   // Startzustand war isHidden – setTabBarHidden hebt das nicht auf
        if #available(iOS 18.0, *) { setTabBarHidden(hidden, animated: animated) } else { tabBar.isHidden = hidden }
    }

    func setBadge(id: String, value: String?, color: UIColor?) {
        guard let i = ids.firstIndex(of: id), let item = viewControllers?[i].tabBarItem else { return }
        item.badgeValue = value
        item.badgeColor = color
    }

    func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
        guard let i = viewControllers?.firstIndex(of: viewController), i < ids.count else { return }
        embed(in: viewController)
        onSelect?(ids[i])
    }
}

@objc(LeverTabBarPlugin)
public class LeverTabBarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LeverTabBarPlugin"
    public let jsName = "LeverTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "select", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setHidden", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBadge", returnType: CAPPluginReturnPromise),
    ]

    /// Tab-Controller finden: über die Controller-Kette oder direkt als Wurzel des Fensters
    private var tabs: LeverTabController? {
        if let t = bridge?.viewController?.tabBarController as? LeverTabController { return t }
        for scene in UIApplication.shared.connectedScenes {
            for window in (scene as? UIWindowScene)?.windows ?? [] {
                if let t = window.rootViewController as? LeverTabController { return t }
            }
        }
        return nil
    }

    @objc func configure(_ call: CAPPluginCall) {
        let items: [(id: String, title: String, symbol: String)] = (call.getArray("items", JSObject.self) ?? []).compactMap {
            guard let id = $0["id"] as? String, let title = $0["title"] as? String, let symbol = $0["symbol"] as? String else { return nil }
            return (id: id, title: title, symbol: symbol)
        }
        let selected = call.getString("selected") ?? items.first?.id ?? ""
        DispatchQueue.main.async {
            guard let tabs = self.tabs else { NSLog("LeverTabBar: kein Tab-Controller"); call.reject("Keine native Tab-Leiste"); return }
            NSLog("LeverTabBar: %d Tabs, Auswahl %@", items.count, selected)
            tabs.onSelect = { [weak self] id in self?.notifyListeners("select", data: ["id": id]) }
            tabs.configure(items: items, selected: selected)
            call.resolve()
        }
    }

    @objc func select(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        DispatchQueue.main.async { self.tabs?.select(id: id); call.resolve() }
    }

    @objc func setHidden(_ call: CAPPluginCall) {
        let hidden = call.getBool("hidden") ?? false
        DispatchQueue.main.async { self.tabs?.setHidden(hidden, animated: true); call.resolve() }
    }

    @objc func setBadge(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        let value = call.getString("value")
        let color: UIColor? = {
            switch call.getString("tone") {
            case "volt": return UIColor(red: 212 / 255, green: 255 / 255, blue: 58 / 255, alpha: 1)
            case "error": return UIColor(red: 1, green: 107 / 255, blue: 94 / 255, alpha: 1)
            default: return nil
            }
        }()
        DispatchQueue.main.async { self.tabs?.setBadge(id: id, value: value, color: color); call.resolve() }
    }
}

/// Bridge-Controller, der das Plugin aus dem App-Target registriert
class LeverBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LeverTabBarPlugin())
    }
}
