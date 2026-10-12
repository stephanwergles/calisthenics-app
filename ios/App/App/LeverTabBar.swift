import UIKit
import Capacitor

/*
 Native Tab-Leiste für Lever – echte UITabBar, unter iOS 26 automatisch im Liquid-Glass-Look.

 Die App hat genau eine Web-Oberfläche (CAPBridgeViewController). Jeder Tab ist ein leerer
 „Platz“; beim Wechsel wandert die Web-Ansicht in den gewählten Platz (ohne Neuladen) und die
 Web-App schaltet über das Ereignis „select“ ihren Bereich um. Gesteuert wird alles aus
 src/client/native.ts – im Browser zeigt die Web-App weiter ihre eigene Leiste.
*/

extension UIFont {
    /// Schmale Systemschrift – Gegenstück zu Barlow Condensed in der Web-Oberfläche
    static func condensed(_ size: CGFloat, _ weight: UIFont.Weight) -> UIFont {
        if #available(iOS 16.0, *) { return .systemFont(ofSize: size, weight: weight, width: .condensed) }
        return .systemFont(ofSize: size, weight: weight)
    }
}

final class LeverTabController: UITabBarController, UITabBarControllerDelegate {
    let bridgeVC: CAPBridgeViewController
    private var ids: [String] = []
    var onSelect: ((String) -> Void)?

    static let ink = UIColor(red: 16 / 255, green: 16 / 255, blue: 16 / 255, alpha: 1)
    static let volt = UIColor(red: 212 / 255, green: 255 / 255, blue: 58 / 255, alpha: 1)

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

    // ── Schwebende Glas-Buttons (Start unten, Zurück oben links) ──
    var onAction: ((String) -> Void)?
    private var actions: [String: UIButton] = [:]

    static func glassConfig(title: String?, symbol: String?, prominent: Bool) -> UIButton.Configuration {
        var cfg: UIButton.Configuration
        if #available(iOS 26.0, *) { cfg = prominent ? .prominentGlass() : .glass() }
        else { cfg = prominent ? .filled() : .gray() }
        if let symbol { cfg.image = UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(weight: .bold)) }
        if let title {
            var t = AttributedString(title.uppercased())
            t.font = UIFont.condensed(19, .heavy)
            cfg.attributedTitle = t
        }
        cfg.imagePadding = 8
        cfg.cornerStyle = .capsule
        if prominent { cfg.baseBackgroundColor = LeverTabController.volt; cfg.baseForegroundColor = LeverTabController.ink }
        else { cfg.baseForegroundColor = .white }
        return cfg
    }

    func setAction(id: String, title: String?, symbol: String?, prominent: Bool, position: String) {
        removeAction(id: id)
        let b = UIButton(configuration: Self.glassConfig(title: title, symbol: symbol, prominent: prominent))
        if prominent { b.tintColor = Self.volt }
        b.accessibilityLabel = title ?? id
        b.translatesAutoresizingMaskIntoConstraints = false
        b.addAction(UIAction { [weak self] _ in
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            self?.onAction?(id)
        }, for: .touchUpInside)
        view.addSubview(b)
        let g = view.safeAreaLayoutGuide
        if position == "topLeading" {
            NSLayoutConstraint.activate([
                b.leadingAnchor.constraint(equalTo: g.leadingAnchor, constant: 16),
                b.topAnchor.constraint(equalTo: g.topAnchor, constant: 8),
                b.widthAnchor.constraint(equalToConstant: 48), b.heightAnchor.constraint(equalToConstant: 48),
            ])
        } else {
            NSLayoutConstraint.activate([
                b.leadingAnchor.constraint(equalTo: g.leadingAnchor, constant: 16),
                b.trailingAnchor.constraint(equalTo: g.trailingAnchor, constant: -16),
                b.bottomAnchor.constraint(equalTo: tabBar.topAnchor, constant: -10),
                b.heightAnchor.constraint(equalToConstant: 58),
            ])
        }
        b.alpha = 0
        UIView.animate(withDuration: 0.2) { b.alpha = 1 }
        actions[id] = b
    }

    func removeAction(id: String) {
        guard let b = actions.removeValue(forKey: id) else { return }
        UIView.animate(withDuration: 0.15, animations: { b.alpha = 0 }) { _ in b.removeFromSuperview() }
    }

    func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
        guard let i = viewControllers?.firstIndex(of: viewController), i < ids.count else { return }
        embed(in: viewController)
        onSelect?(ids[i])
    }
}

/// Natives Sheet (UISheetPresentationController, ab iOS 26 mit Glas): Titel, Abschnitte, Aktionen.
/// Antwortet mit der gewählten Aktion oder nil, wenn weggewischt.
final class LeverSheetController: UIViewController, UISheetPresentationControllerDelegate {
    struct Section { let title: String; let text: String; let warn: Bool }
    struct Action { let id: String; let title: String; let symbol: String?; let style: String }
    private let heading: String, sub: String?, sections: [Section], sheetActions: [Action]
    private let done: (String?) -> Void
    private var answered = false

    init(title: String, sub: String?, sections: [Section], actions: [Action], done: @escaping (String?) -> Void) {
        heading = title; self.sub = sub; self.sections = sections; sheetActions = actions; self.done = done
        super.init(nibName: nil, bundle: nil)
        overrideUserInterfaceStyle = .dark
        if let sheet = sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
            sheet.prefersScrollingExpandsWhenScrolledToEdge = true
            sheet.delegate = self
        }
    }
    required init?(coder: NSCoder) { fatalError() }

    func finish(_ id: String?) {
        guard !answered else { return }
        answered = true; done(id)
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish(nil) }

    override func viewDidLoad() {
        super.viewDidLoad()
        if #unavailable(iOS 26.0) { view.backgroundColor = UIColor(red: 0.1, green: 0.1, blue: 0.1, alpha: 1) }
        let scroll = UIScrollView(); scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)
        let stack = UIStackView(); stack.axis = .vertical; stack.spacing = 14; stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.topAnchor), scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor), scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 28),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -24),
            stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -22),
        ])
        let h = UILabel(); h.text = heading.uppercased(); h.numberOfLines = 0
        h.font = UIFont.condensed(28, .black)
        stack.addArrangedSubview(h)
        if let sub {
            let l = UILabel(); l.text = sub; l.numberOfLines = 0; l.textColor = .secondaryLabel; l.font = .preferredFont(forTextStyle: .subheadline)
            stack.addArrangedSubview(l); stack.setCustomSpacing(18, after: l)
        }
        for sec in sections {
            let t = UILabel(); t.text = sec.title.uppercased(); t.font = UIFont.systemFont(ofSize: 12, weight: .bold)
            t.textColor = sec.warn ? UIColor(red: 0.9, green: 0.6, blue: 0.6, alpha: 1) : .label
            let b = UILabel(); b.text = sec.text; b.numberOfLines = 0; b.font = .preferredFont(forTextStyle: .body); b.textColor = .secondaryLabel
            let v = UIStackView(arrangedSubviews: [t, b]); v.axis = .vertical; v.spacing = 4
            stack.addArrangedSubview(v)
        }
        if !sheetActions.isEmpty {
            let grid = UIStackView(); grid.axis = .vertical; grid.spacing = 10
            for a in sheetActions {
                let prominent = a.style == "prominent"
                var cfg = LeverTabController.glassConfig(title: nil, symbol: a.symbol, prominent: prominent)
                var t = AttributedString(a.title); t.font = UIFont.systemFont(ofSize: 16, weight: .semibold); cfg.attributedTitle = t
                if a.style == "destructive" { cfg.baseForegroundColor = .systemRed }
                let btn = UIButton(configuration: cfg)
                if prominent { btn.tintColor = LeverTabController.volt }
                btn.heightAnchor.constraint(equalToConstant: 50).isActive = true
                btn.addAction(UIAction { [weak self] _ in
                    self?.finish(a.id)
                    self?.dismiss(animated: true)
                }, for: .touchUpInside)
                grid.addArrangedSubview(btn)
            }
            stack.setCustomSpacing(24, after: stack.arrangedSubviews.last!)
            stack.addArrangedSubview(grid)
        }
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
        CAPPluginMethod(name: "setAction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentSheet", returnType: CAPPluginReturnPromise),
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
            tabs.onAction = { [weak self] id in self?.notifyListeners("action", data: ["id": id]) }
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

extension LeverTabBarPlugin {
    @objc func setAction(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        let title = call.getString("title"), symbol = call.getString("symbol")
        let prominent = call.getBool("prominent") ?? false
        let position = call.getString("position") ?? "bottom"
        DispatchQueue.main.async { self.tabsRef?.setAction(id: id, title: title, symbol: symbol, prominent: prominent, position: position); call.resolve() }
    }

    @objc func removeAction(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        DispatchQueue.main.async { self.tabsRef?.removeAction(id: id); call.resolve() }
    }

    @objc func presentSheet(_ call: CAPPluginCall) {
        let sections = (call.getArray("sections", JSObject.self) ?? []).compactMap { o -> LeverSheetController.Section? in
            guard let t = o["title"] as? String, let x = o["text"] as? String else { return nil }
            return .init(title: t, text: x, warn: (o["warn"] as? Bool) ?? false)
        }
        let actions = (call.getArray("actions", JSObject.self) ?? []).compactMap { o -> LeverSheetController.Action? in
            guard let id = o["id"] as? String, let t = o["title"] as? String else { return nil }
            return .init(id: id, title: t, symbol: o["symbol"] as? String, style: (o["style"] as? String) ?? "glass")
        }
        let title = call.getString("title") ?? "", sub = call.getString("subtitle")
        DispatchQueue.main.async {
            guard let host = self.tabsRef else { call.reject("Kein Controller"); return }
            let vc = LeverSheetController(title: title, sub: sub, sections: sections, actions: actions) { id in
                call.resolve(["action": id as Any])
            }
            var top: UIViewController = host
            while let p = top.presentedViewController, !p.isBeingDismissed { top = p }
            top.present(vc, animated: true)
            // Scheitert das Präsentieren (z. B. System-Dialog offen), antwortet das Sheet nie –
            // dann mit nil auflösen, damit die Web-Seite nicht im Sheet-Zustand hängen bleibt
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { if vc.presentingViewController == nil { vc.finish(nil) } }
        }
    }

    var tabsRef: LeverTabController? {
        for scene in UIApplication.shared.connectedScenes {
            for window in (scene as? UIWindowScene)?.windows ?? [] {
                if let t = window.rootViewController as? LeverTabController { return t }
            }
        }
        return nil
    }
}

/// Bridge-Controller, der das Plugin aus dem App-Target registriert
class LeverBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LeverTabBarPlugin())
    }
}
