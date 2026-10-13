import UIKit
import Capacitor
import AVFoundation

/*
 Native Sheets für Lever. Die Web-App beschreibt ein Sheet als Bausteine (src/client/native.ts,
 Typ NSheet); hier wird daraus UIKit – echte UISheetPresentationController mit Detents und
 echten Liquid-Glass-Buttons (iOS 26). Zustand und Logik bleiben in der Web-App: Tipps,
 Häkchen und Texteingaben gehen als Ereignis „sheet“ zurück, die Web-App schickt das
 aktualisierte Sheet (showSheet mit gleicher id = Aktualisierung an Ort und Stelle).

 Dazu das Erfassungs-Panel im Training (LeverSetPanel): dauerhaftes Sheet mit zwei Höhen,
 Training dahinter bleibt bedienbar; aktualisiert sich ohne Neuaufbau (Timer 10×/s).
*/

// MARK: - Schrift: Barlow aus dem App-Paket (dieselben Dateien wie die Web-Oberfläche)

enum LeverFonts {
    static var ready = false
    /// next/font liefert Barlow als WOFF2 in Teilmengen (latin, latin-ext, …). Registriert wird
    /// je Schnitt die Datei, die alle deutschen Zeichen enthält.
    static func register() {
        guard !ready, let base = Bundle.main.resourceURL?.appendingPathComponent("public/_next/static/media"),
              let files = try? FileManager.default.contentsOfDirectory(at: base, includingPropertiesForKeys: nil) else { return }
        ready = true
        var done = Set<String>()
        let probe = Array("AÄÖÜßaäöüz0123456789·–„“".utf16)
        for url in files where url.pathExtension == "woff2" {
            guard let data = try? Data(contentsOf: url) as CFData,
                  let descs = CTFontManagerCreateFontDescriptorsFromData(data) as? [CTFontDescriptor],
                  let d = descs.first,
                  let name = CTFontDescriptorCopyAttribute(d, kCTFontNameAttribute) as? String, !done.contains(name),
                  let provider = CGDataProvider(data: data), let cg = CGFont(provider) else { continue }
            let ct = CTFontCreateWithGraphicsFont(cg, 12, nil, nil)
            var glyphs = [CGGlyph](repeating: 0, count: probe.count)
            guard CTFontGetGlyphsForCharacters(ct, probe, &glyphs, probe.count) else { continue }
            if CTFontManagerRegisterGraphicsFont(cg, nil) { done.insert(name) }
        }
    }
}

extension UIFont {
    /// Barlow Condensed (Überschriften, Zahlen) – fällt auf die schmale Systemschrift zurück
    static func display(_ size: CGFloat, _ weight: UIFont.Weight = .heavy, italic: Bool = false) -> UIFont {
        LeverFonts.register()
        let w: String = weight == .black ? "Black" : weight == .heavy ? "ExtraBold" : weight == .bold ? "Bold" : "SemiBold"
        if let f = UIFont(name: "BarlowCondensed-\(w)\(italic ? "Italic" : "")", size: size) { return f }
        return .condensed(size, weight)
    }
    /// Barlow (Fließtext, Buttons)
    static func body(_ size: CGFloat, _ weight: UIFont.Weight = .regular) -> UIFont {
        LeverFonts.register()
        let w: String = weight == .bold ? "Bold" : weight == .semibold ? "SemiBold" : weight == .medium ? "Medium" : "Regular"
        return UIFont(name: "Barlow-\(w)", size: size) ?? .systemFont(ofSize: size, weight: weight)
    }
}

// MARK: - Farben und Glas-Buttons

enum Lever {
    static let ink = LeverTabController.ink
    static let volt = LeverTabController.volt
    static let muted = UIColor(white: 0.6, alpha: 1)
    static let line = UIColor(white: 1, alpha: 0.1)
    static let card = UIColor(white: 1, alpha: 0.05)
    static let danger = UIColor(red: 1, green: 0.42, blue: 0.37, alpha: 1)

    /// Echte Glas-Konfiguration (iOS 26), sonst Fläche. style: glass | prominent | destructive
    static func button(title: String?, symbol: String? = nil, style: String = "glass", size: CGFloat = 17, display: Bool = false, upper: Bool = true) -> UIButton {
        let b = UIButton(configuration: config(title: title, symbol: symbol, style: style, size: size, display: display, upper: upper))
        if style == "prominent" { b.tintColor = volt }
        b.accessibilityLabel = title
        return b
    }
    static func config(title: String?, symbol: String? = nil, style: String = "glass", size: CGFloat = 17, display: Bool = false, upper: Bool = true) -> UIButton.Configuration {
        var cfg: UIButton.Configuration
        let prominent = style == "prominent"
        // In Sheets liegt alles schon auf Glas – Glas auf Glas hat kaum Kontrast. Deshalb hier
        // helle, halbtransparente Flächen; echtes Glas nur für die Volt-Hauptaktion und die
        // frei schwebenden Knöpfe (LeverTabController.glassConfig).
        if prominent, #available(iOS 26.0, *) { cfg = .prominentGlass() }
        else { cfg = .filled() }
        if !prominent {
            cfg.background.backgroundColor = style == "destructive" ? UIColor(red: 1, green: 0.42, blue: 0.37, alpha: 0.16) : UIColor(white: 1, alpha: 0.14)
            cfg.background.strokeColor = UIColor(white: 1, alpha: 0.12); cfg.background.strokeWidth = 1
        }
        cfg.cornerStyle = .capsule
        if let symbol { cfg.image = UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: size * 0.95, weight: .semibold)) }
        cfg.imagePadding = 8
        if let title {
            var t = AttributedString(display && upper ? title.uppercased() : title)
            t.font = display ? UIFont.display(size + 2, .heavy) : UIFont.body(size, .semibold)
            // prominentes Glas tönt Inhalte ein (wirkt dunkelgrün) – Schwarz fest vorgeben
            if prominent { t.foregroundColor = ink }
            cfg.attributedTitle = t
        }
        if prominent {
            cfg.baseBackgroundColor = volt; cfg.baseForegroundColor = ink
            cfg.imageColorTransformer = UIConfigurationColorTransformer { _ in ink }
            cfg.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { a in var a = a; a.foregroundColor = ink; return a }
        }
        else if style == "destructive" { cfg.baseForegroundColor = danger }
        else { cfg.baseForegroundColor = .white }
        return cfg
    }
    /// Konfiguration eines bestehenden Buttons tauschen (behält Aktionen und Platz)
    static func restyle(_ b: UIButton, title: String?, symbol: String? = nil, style: String = "glass", size: CGFloat = 17, display: Bool = false) {
        b.configuration = config(title: title, symbol: symbol, style: style, size: size, display: display)
        b.tintColor = style == "prominent" ? volt : nil
        b.accessibilityLabel = title ?? b.accessibilityLabel
    }
}

// MARK: - Datenmodell (gespiegelt von NSheet in native.ts)

struct NButton: Decodable { let id: String; let title: String; let symbol: String?; let style: String? }
struct NStat: Decodable { let value: String; let label: String; let accent: Bool?; let delta: String? }
struct NOption: Decodable { let id: String; let title: String }
struct NBlock: Decodable {
    let type: String
    let id: String?, title: String?, subtitle: String?, text: String?, style: String?
    let trailing: String?, eyebrow: String?, state: String?, chips: [String]?, delta: String?
    let on: Bool?, value: String?, label: String?, placeholder: String?, keyboard: String?, symbol: String?
    let items: [NStat]?, options: [NOption]?, selected: String?, done: Int?, total: Int?, buttons: [NButton]?
    let before: Double?, now: Double?, max: Double?
    let clip: String?
}
struct NSheetSpec: Decodable {
    let id: String; let title: String; let subtitle: String?
    /// "auto" (Inhaltshöhe), "medium", "large"
    let detents: [String]?
    let blocks: [NBlock]
    let footer: [NButton]?
}

private func decode<T: Decodable>(_ type: T.Type, _ obj: JSObject?) -> T? {
    guard let obj, JSONSerialization.isValidJSONObject(obj),
          let data = try? JSONSerialization.data(withJSONObject: obj) else { return nil }
    do { return try JSONDecoder().decode(type, from: data) }
    catch { NSLog("LeverSheets: %@", String(describing: error)); return nil }
}

// MARK: - Generisches Sheet

final class LeverNativeSheet: UIViewController, UISheetPresentationControllerDelegate, UITextViewDelegate {
    private(set) var spec: NSheetSpec
    let emit: (_ type: String, _ id: String?, _ value: Any?) -> Void
    private let scroll = UIScrollView()
    private let stack = UIStackView()
    private let foot = UIStackView()
    private var fields: [String: UITextView] = [:]
    var closedByApp = false

    init(spec: NSheetSpec, emit: @escaping (String, String?, Any?) -> Void) {
        self.spec = spec; self.emit = emit
        super.init(nibName: nil, bundle: nil)
        overrideUserInterfaceStyle = .dark
        if let sheet = sheetPresentationController {
            sheet.delegate = self
            sheet.prefersGrabberVisible = true
            sheet.prefersScrollingExpandsWhenScrolledToEdge = true
            applyDetents()
        }
    }
    required init?(coder: NSCoder) { fatalError() }

    private func applyDetents() {
        guard let sheet = sheetPresentationController else { return }
        let wanted = spec.detents ?? ["medium", "large"]
        sheet.detents = wanted.map { d -> UISheetPresentationController.Detent in
            switch d {
            case "large": return .large()
            case "auto":
                return .custom(identifier: .init("auto")) { [weak self] ctx in
                    guard let self else { return ctx.maximumDetentValue * 0.5 }
                    return min(ctx.maximumDetentValue, self.contentHeight())
                }
            default: return .medium()
            }
        }
    }

    private func contentHeight() -> CGFloat {
        view.layoutIfNeeded()
        let w = view.bounds.width > 0 ? view.bounds.width : UIScreen.main.bounds.width
        let s = stack.systemLayoutSizeFitting(CGSize(width: w - 44, height: UIView.layoutFittingCompressedSize.height),
                                              withHorizontalFittingPriority: .required, verticalFittingPriority: .fittingSizeLevel).height
        let f = foot.arrangedSubviews.isEmpty ? 0 : foot.systemLayoutSizeFitting(CGSize(width: w - 44, height: 0),
                                                                                 withHorizontalFittingPriority: .required, verticalFittingPriority: .fittingSizeLevel).height + 16
        return s + 30 + 24 + f + view.safeAreaInsets.bottom
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        if !closedByApp { emit("dismiss", nil, nil) }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if #unavailable(iOS 26.0) { view.backgroundColor = UIColor(white: 0.1, alpha: 1) }
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        scroll.keyboardDismissMode = .interactive
        view.addSubview(scroll)
        stack.axis = .vertical; stack.spacing = 12; stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        foot.axis = .horizontal; foot.spacing = 10; foot.distribution = .fillEqually; foot.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(foot)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor), scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: foot.topAnchor, constant: -8),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 30),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -24),
            stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -22),
            foot.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 22),
            foot.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -22),
            foot.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor, constant: -10),
        ])
        render()
    }

    func update(_ next: NSheetSpec) {
        let detentsChanged = next.detents != spec.detents
        spec = next
        if detentsChanged { applyDetents() }
        let y = scroll.contentOffset.y
        render()
        scroll.layoutIfNeeded()
        scroll.contentOffset.y = min(y, max(0, scroll.contentSize.height - scroll.bounds.height + scroll.adjustedContentInset.bottom))
        if #available(iOS 16.0, *) { sheetPresentationController?.animateChanges { sheetPresentationController?.invalidateDetents() } }
    }

    // MARK: Aufbau

    private func render() {
        stack.arrangedSubviews.forEach { if !($0 is FieldBox) { $0.removeFromSuperview() } else { stack.removeArrangedSubview($0); $0.removeFromSuperview() } }
        let head = UIStackView(); head.axis = .vertical; head.spacing = 3
        let h = UILabel(); h.text = spec.title.uppercased(); h.numberOfLines = 0; h.font = .display(30, .black); h.textColor = .white
        head.addArrangedSubview(h)
        if let s = spec.subtitle { head.addArrangedSubview(label(s, .body(15), Lever.muted)) }
        stack.addArrangedSubview(head)
        stack.setCustomSpacing(18, after: head)
        for b in spec.blocks { if let v = view(for: b) { stack.addArrangedSubview(v) } }

        foot.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for f in spec.footer ?? [] {
            let b = Lever.button(title: f.title, symbol: f.symbol, style: f.style ?? "glass", size: 17, display: f.style == "prominent")
            b.heightAnchor.constraint(equalToConstant: 56).isActive = true
            b.addAction(UIAction { [weak self] _ in self?.tapped(f.id) }, for: .touchUpInside)
            foot.addArrangedSubview(b)
        }
    }

    private func tapped(_ id: String) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        emit("tap", id, nil)
    }

    private func label(_ text: String, _ font: UIFont, _ color: UIColor = .white, lines: Int = 0) -> UILabel {
        let l = UILabel(); l.text = text; l.font = font; l.textColor = color; l.numberOfLines = lines; return l
    }

    private func card(_ content: UIView, tint: UIColor? = nil, padding: CGFloat = 14) -> UIView {
        let box = UIView()
        box.backgroundColor = tint ?? Lever.card
        box.layer.cornerRadius = 20; box.layer.cornerCurve = .continuous
        box.layer.borderWidth = 1; box.layer.borderColor = (tint == nil ? Lever.line : Lever.volt.withAlphaComponent(0.35)).cgColor
        content.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: box.topAnchor, constant: padding),
            content.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -padding),
            content.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: padding + 2),
            content.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -padding),
        ])
        return box
    }

    private func chipsRow(_ chips: [String], accent: Bool = false) -> UIView {
        let row = UIStackView(); row.axis = .horizontal; row.spacing = 6; row.alignment = .center
        for c in chips.prefix(10) {
            let l = PaddedLabel(); l.text = c; l.font = .display(17, .heavy); l.textColor = accent ? Lever.ink : .white
            l.backgroundColor = accent ? Lever.volt : UIColor(white: 1, alpha: 0.09)
            l.layer.cornerRadius = 10; l.layer.cornerCurve = .continuous; l.clipsToBounds = true
            row.addArrangedSubview(l)
        }
        row.addArrangedSubview(UIView())
        return row
    }

    private func view(for b: NBlock) -> UIView? {
        switch b.type {
        case "section":
            let l = label((b.title ?? "").uppercased(), .display(22, .black))
            let wrap = UIStackView(arrangedSubviews: [l]); wrap.isLayoutMarginsRelativeArrangement = true
            wrap.layoutMargins = UIEdgeInsets(top: 10, left: 0, bottom: 0, right: 0)
            return wrap

        case "text":
            let style = b.style ?? "body"
            let color: UIColor = style == "muted" ? Lever.muted : style == "warn" ? Lever.danger : style == "accent" ? Lever.volt : .white
            let l = label(b.text ?? "", .body(style == "small" ? 13 : 16, style == "accent" ? .semibold : .regular), color)
            if let t = b.title {
                let head = label(t.uppercased(), .body(12, .bold), style == "warn" ? Lever.danger : .white)
                let v = UIStackView(arrangedSubviews: [head, l]); v.axis = .vertical; v.spacing = 4
                l.textColor = style == "warn" ? .secondaryLabel : .secondaryLabel
                return v
            }
            if style == "note" {
                let icon = UIImageView(image: UIImage(systemName: "text.bubble")); icon.tintColor = Lever.volt
                icon.setContentHuggingPriority(.required, for: .horizontal)
                let h = UIStackView(arrangedSubviews: [icon, l]); h.spacing = 10; h.alignment = .top
                l.font = .body(15)
                return card(h, tint: Lever.volt.withAlphaComponent(0.1), padding: 12)
            }
            return l

        case "stats":
            let row = UIStackView(); row.axis = .horizontal; row.spacing = 10; row.distribution = .fillEqually
            for s in b.items ?? [] {
                let v = UIStackView(); v.axis = .vertical; v.spacing = 2
                v.addArrangedSubview(label(s.value, .display(40, .heavy), s.accent == true ? Lever.volt : .white, lines: 1))
                let cap = label(s.label.uppercased(), .body(11.5, .bold), Lever.muted, lines: 1)
                if let d = s.delta {
                    let dl = label(d, .body(12, .bold), d.hasPrefix("+") ? Lever.volt : Lever.muted, lines: 1)
                    let h = UIStackView(arrangedSubviews: [cap, dl]); h.spacing = 6
                    v.addArrangedSubview(h)
                } else { v.addArrangedSubview(cap) }
                row.addArrangedSubview(card(v, padding: 12))
            }
            return row

        case "segments":
            let total = max(1, b.total ?? 1), done = b.done ?? 0
            let bar = UIStackView(); bar.axis = .horizontal; bar.spacing = 4; bar.distribution = .fillEqually
            for i in 0..<total {
                let seg = UIView(); seg.backgroundColor = i < done ? Lever.volt : UIColor(white: 1, alpha: 0.1)
                seg.layer.cornerRadius = 3; seg.heightAnchor.constraint(equalToConstant: 6).isActive = true
                bar.addArrangedSubview(seg)
            }
            if let l = b.label {
                let v = UIStackView(arrangedSubviews: [bar, label(l, .body(13), Lever.muted)]); v.axis = .vertical; v.spacing = 6
                return v
            }
            return bar

        case "progress":
            let track = UIView(); track.backgroundColor = UIColor(white: 1, alpha: 0.1); track.layer.cornerRadius = 3
            track.heightAnchor.constraint(equalToConstant: 6).isActive = true
            let fill = UIView(); fill.backgroundColor = Lever.volt; fill.layer.cornerRadius = 3; fill.translatesAutoresizingMaskIntoConstraints = false
            track.addSubview(fill)
            let share = CGFloat(Double(b.value ?? "0") ?? 0)
            NSLayoutConstraint.activate([fill.leadingAnchor.constraint(equalTo: track.leadingAnchor), fill.topAnchor.constraint(equalTo: track.topAnchor),
                                         fill.bottomAnchor.constraint(equalTo: track.bottomAnchor),
                                         fill.widthAnchor.constraint(equalTo: track.widthAnchor, multiplier: max(0.001, min(1, share)))])
            return track

        case "row":
            let state = b.state ?? "open"
            let v = UIStackView(); v.axis = .vertical; v.spacing = 3
            if let e = b.eyebrow { v.addArrangedSubview(label(e.uppercased(), .body(11.5, .bold), Lever.volt, lines: 1)) }
            v.addArrangedSubview(label(b.title ?? "", .body(17, .semibold), state == "skipped" || state == "paused" ? Lever.muted : .white))
            if let s = b.subtitle { v.addArrangedSubview(label(s, .body(13.5), Lever.muted)) }
            if let c = b.chips, !c.isEmpty { v.setCustomSpacing(8, after: v.arrangedSubviews.last!); v.addArrangedSubview(chipsRow(c)) }
            let h = UIStackView(); h.spacing = 12; h.alignment = .center
            let mark = UIImageView(image: UIImage(systemName: state == "done" ? "checkmark.circle.fill" : state == "skipped" ? "minus.circle" : state == "paused" ? "pause.circle" : "circle"))
            mark.tintColor = state == "done" ? .white : state == "next" ? Lever.volt : Lever.muted
            mark.preferredSymbolConfiguration = .init(pointSize: 24, weight: .regular)
            mark.setContentHuggingPriority(.required, for: .horizontal)
            if let clip = b.clip {
                // 3D-Standbild statt Statuskreis; der Status sitzt als Abzeichen unten rechts im Bild
                let thumb = UIImageView(); thumb.contentMode = .scaleAspectFill; thumb.clipsToBounds = true
                thumb.layer.cornerRadius = 12; thumb.layer.cornerCurve = .continuous
                thumb.backgroundColor = UIColor(white: 1, alpha: 0.04)
                thumb.translatesAutoresizingMaskIntoConstraints = false
                thumb.alpha = state == "skipped" || state == "paused" ? 0.4 : 1
                let holder = UIView(); holder.translatesAutoresizingMaskIntoConstraints = false
                holder.addSubview(thumb)
                NSLayoutConstraint.activate([holder.widthAnchor.constraint(equalToConstant: 60), holder.heightAnchor.constraint(equalToConstant: 60),
                                             thumb.topAnchor.constraint(equalTo: holder.topAnchor), thumb.bottomAnchor.constraint(equalTo: holder.bottomAnchor),
                                             thumb.leadingAnchor.constraint(equalTo: holder.leadingAnchor), thumb.trailingAnchor.constraint(equalTo: holder.trailingAnchor)])
                ClipStill.load(clip) { [weak thumb] img in thumb?.image = img }
                if state != "open" {
                    let badge = UIImageView(image: mark.image); badge.tintColor = mark.tintColor
                    badge.preferredSymbolConfiguration = .init(pointSize: 18, weight: .semibold)
                    badge.backgroundColor = UIColor(white: 0.12, alpha: 1); badge.layer.cornerRadius = 11; badge.clipsToBounds = true
                    badge.translatesAutoresizingMaskIntoConstraints = false
                    holder.addSubview(badge)
                    NSLayoutConstraint.activate([badge.widthAnchor.constraint(equalToConstant: 22), badge.heightAnchor.constraint(equalToConstant: 22),
                                                 badge.trailingAnchor.constraint(equalTo: holder.trailingAnchor, constant: 4),
                                                 badge.bottomAnchor.constraint(equalTo: holder.bottomAnchor, constant: 4)])
                }
                h.addArrangedSubview(holder)
            } else if b.symbol != "none" { h.addArrangedSubview(mark) }
            h.addArrangedSubview(v)
            if let t = b.trailing ?? b.delta {
                let tl = label(t, b.delta != nil ? .display(20, .heavy) : .body(14), b.delta?.hasPrefix("+") == true ? Lever.volt : Lever.muted, lines: 1)
                tl.setContentHuggingPriority(.required, for: .horizontal); tl.setContentCompressionResistancePriority(.required, for: .horizontal)
                h.addArrangedSubview(tl)
            }
            let box = card(h, tint: state == "next" ? Lever.volt.withAlphaComponent(0.12) : nil, padding: 13)
            if let id = b.id {
                let tap = UIButton(type: .custom); tap.translatesAutoresizingMaskIntoConstraints = false
                tap.addAction(UIAction { [weak self] _ in self?.tapped(id) }, for: .touchUpInside)
                tap.accessibilityLabel = b.title
                box.addSubview(tap)
                NSLayoutConstraint.activate([tap.topAnchor.constraint(equalTo: box.topAnchor), tap.bottomAnchor.constraint(equalTo: box.bottomAnchor),
                                             tap.leadingAnchor.constraint(equalTo: box.leadingAnchor), tap.trailingAnchor.constraint(equalTo: box.trailingAnchor)])
                let chev = UIImageView(image: UIImage(systemName: "chevron.right")); chev.tintColor = Lever.muted
                chev.preferredSymbolConfiguration = .init(pointSize: 13, weight: .semibold)
                if b.trailing == nil && b.delta == nil { chev.setContentHuggingPriority(.required, for: .horizontal); h.addArrangedSubview(chev) }
            }
            return box

        case "check":
            let on = b.on == true
            let h = UIStackView(); h.spacing = 12; h.alignment = .center
            let mark = UIImageView(image: UIImage(systemName: on ? "checkmark.square.fill" : "square"))
            mark.tintColor = on ? Lever.volt : Lever.muted
            mark.preferredSymbolConfiguration = .init(pointSize: 22, weight: .regular)
            mark.setContentHuggingPriority(.required, for: .horizontal)
            let v = UIStackView(); v.axis = .vertical; v.spacing = 2
            v.addArrangedSubview(label(b.title ?? "", .body(16, .semibold), on ? Lever.muted : .white))
            if let s = b.subtitle { v.addArrangedSubview(label(s, .body(13), Lever.muted)) }
            h.addArrangedSubview(mark); h.addArrangedSubview(v)
            let btn = UIButton(type: .custom)
            btn.addAction(UIAction { [weak self] _ in
                UISelectionFeedbackGenerator().selectionChanged()
                self?.emit("toggle", b.id, !on)
            }, for: .touchUpInside)
            btn.accessibilityLabel = b.title; btn.accessibilityTraits = on ? [.button, .selected] : .button
            h.isUserInteractionEnabled = false
            btn.addSubview(h); h.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([h.topAnchor.constraint(equalTo: btn.topAnchor, constant: 8), h.bottomAnchor.constraint(equalTo: btn.bottomAnchor, constant: -8),
                                         h.leadingAnchor.constraint(equalTo: btn.leadingAnchor, constant: 4), h.trailingAnchor.constraint(equalTo: btn.trailingAnchor)])
            return btn

        case "disclosure":
            let open = b.on == true
            let b2 = UIButton(type: .custom)
            let h = UIStackView(); h.spacing = 8; h.alignment = .center; h.isUserInteractionEnabled = false
            h.addArrangedSubview(label((b.title ?? "").uppercased(), .display(19, .heavy)))
            h.addArrangedSubview(UIView())
            h.addArrangedSubview(label(b.trailing ?? "", .display(19, .heavy), Lever.muted, lines: 1))
            let chev = UIImageView(image: UIImage(systemName: open ? "chevron.up" : "chevron.down")); chev.tintColor = Lever.muted
            h.addArrangedSubview(chev)
            let box = card(h, padding: 15)
            box.isUserInteractionEnabled = false
            b2.addSubview(box); box.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([box.topAnchor.constraint(equalTo: b2.topAnchor), box.bottomAnchor.constraint(equalTo: b2.bottomAnchor),
                                         box.leadingAnchor.constraint(equalTo: b2.leadingAnchor), box.trailingAnchor.constraint(equalTo: b2.trailingAnchor)])
            b2.addAction(UIAction { [weak self] _ in self?.emit("toggle", b.id, !open) }, for: .touchUpInside)
            b2.accessibilityLabel = b.title
            return b2

        case "record":
            let badge = UIImageView(image: UIImage(systemName: "trophy.fill")); badge.tintColor = Lever.ink
            badge.backgroundColor = Lever.volt; badge.contentMode = .center; badge.layer.cornerRadius = 12
            badge.widthAnchor.constraint(equalToConstant: 42).isActive = true; badge.heightAnchor.constraint(equalToConstant: 42).isActive = true
            let v = UIStackView(arrangedSubviews: [label(b.title ?? "", .body(16, .semibold)), label(b.subtitle ?? "", .body(13), Lever.muted)])
            v.axis = .vertical; v.spacing = 2
            let val = label(b.value ?? "", .display(24, .heavy), Lever.volt, lines: 1)
            val.setContentHuggingPriority(.required, for: .horizontal)
            let h = UIStackView(arrangedSubviews: [badge, v, val]); h.spacing = 12; h.alignment = .center
            return card(h, tint: Lever.volt.withAlphaComponent(0.1), padding: 12)

        case "ladder":
            let state = b.state ?? "locked"
            let dot = PaddedLabel(); dot.textAlignment = .center
            dot.text = state == "done" || state == "locked" ? "" : (b.label ?? "")
            dot.font = .display(18, .heavy)
            dot.textColor = state == "current" ? Lever.ink : .white
            dot.backgroundColor = state == "current" ? Lever.volt : state == "done" ? UIColor(white: 0.95, alpha: 1) : UIColor(white: 1, alpha: 0.06)
            dot.layer.cornerRadius = 20; dot.clipsToBounds = true
            dot.widthAnchor.constraint(equalToConstant: 40).isActive = true; dot.heightAnchor.constraint(equalToConstant: 40).isActive = true
            if state == "locked" || state == "done" {
                // erledigt = kreideweiß mit kräftigem Häkchen (wie erledigte Sätze), gesperrt = Schloss
                let icon = UIImageView(image: UIImage(systemName: state == "done" ? "checkmark" : "lock.fill",
                                                      withConfiguration: UIImage.SymbolConfiguration(pointSize: state == "done" ? 12 : 11, weight: .black)))
                icon.tintColor = state == "done" ? Lever.ink : Lever.muted; icon.translatesAutoresizingMaskIntoConstraints = false
                dot.addSubview(icon)
                NSLayoutConstraint.activate([icon.centerXAnchor.constraint(equalTo: dot.centerXAnchor), icon.centerYAnchor.constraint(equalTo: dot.centerYAnchor)])
            }
            let v = UIStackView(arrangedSubviews: [label((b.title ?? "").uppercased(), .display(19, .heavy), state == "locked" ? Lever.muted : .white),
                                                  label(b.subtitle ?? "", .body(13.5), Lever.muted)])
            v.axis = .vertical; v.spacing = 2
            var lead: UIView = dot
            if let clip = b.clip {
                // 3D-Standbild der Stufe, Punkt (Nummer/Häkchen/Schloss) als Abzeichen darauf
                let holder = UIView(); holder.translatesAutoresizingMaskIntoConstraints = false
                let thumb = UIImageView(); thumb.contentMode = .scaleAspectFill; thumb.clipsToBounds = true
                thumb.layer.cornerRadius = 14; thumb.layer.cornerCurve = .continuous
                thumb.backgroundColor = UIColor(white: 1, alpha: 0.04)
                thumb.alpha = state == "locked" ? 0.35 : 1
                thumb.translatesAutoresizingMaskIntoConstraints = false
                holder.addSubview(thumb)
                dot.removeConstraints(dot.constraints.filter { $0.firstAttribute == .width || $0.firstAttribute == .height })
                dot.translatesAutoresizingMaskIntoConstraints = false; dot.layer.cornerRadius = 13
                dot.font = .display(14, .heavy); dot.layer.borderWidth = 2; dot.layer.borderColor = UIColor(white: 0.12, alpha: 1).cgColor
                holder.addSubview(dot)
                NSLayoutConstraint.activate([
                    holder.widthAnchor.constraint(equalToConstant: 72), holder.heightAnchor.constraint(equalToConstant: 72),
                    thumb.topAnchor.constraint(equalTo: holder.topAnchor), thumb.bottomAnchor.constraint(equalTo: holder.bottomAnchor),
                    thumb.leadingAnchor.constraint(equalTo: holder.leadingAnchor), thumb.trailingAnchor.constraint(equalTo: holder.trailingAnchor),
                    dot.widthAnchor.constraint(equalToConstant: 26), dot.heightAnchor.constraint(equalToConstant: 26),
                    dot.trailingAnchor.constraint(equalTo: holder.trailingAnchor, constant: 5), dot.bottomAnchor.constraint(equalTo: holder.bottomAnchor, constant: 5),
                ])
                ClipStill.load(clip) { [weak thumb] img in thumb?.image = img }
                lead = holder
            }
            let h = UIStackView(arrangedSubviews: [lead, v]); h.spacing = 14; h.alignment = .center
            // jede Stufe im gleichen Rahmen-Abstand – Bilder stehen auf einer Linie, nur die aktive ist eingefärbt
            let box = card(h, tint: state == "current" ? Lever.volt.withAlphaComponent(0.1) : .clear, padding: 12)
            if state != "current" { box.layer.borderColor = UIColor.clear.cgColor }
            return box

        case "compare":
            // Balken: letztes Mal (grau) und heute (Volt) relativ zum größten Wert, rechts das Delta
            let name = label(b.title ?? "", .body(15, .semibold), .white)
            let m = max(1, b.max ?? 1)
            func bar(_ v: Double, _ color: UIColor) -> UIView {
                let track = UIView(); track.heightAnchor.constraint(equalToConstant: 7).isActive = true
                let fill = UIView(); fill.backgroundColor = color; fill.layer.cornerRadius = 3.5; fill.translatesAutoresizingMaskIntoConstraints = false
                track.addSubview(fill)
                NSLayoutConstraint.activate([fill.leadingAnchor.constraint(equalTo: track.leadingAnchor), fill.topAnchor.constraint(equalTo: track.topAnchor),
                                             fill.bottomAnchor.constraint(equalTo: track.bottomAnchor),
                                             fill.widthAnchor.constraint(equalTo: track.widthAnchor, multiplier: CGFloat(Swift.max(0.02, Swift.min(1, v / m))))])
                return track
            }
            let bars = UIStackView(arrangedSubviews: [bar(b.before ?? 0, UIColor(white: 1, alpha: 0.28)), bar(b.now ?? 0, Lever.volt)])
            bars.axis = .vertical; bars.spacing = 4
            let d = label(b.delta ?? "", .display(22, .heavy), (b.delta ?? "").hasPrefix("+") ? Lever.volt : Lever.muted, lines: 1)
            d.setContentHuggingPriority(.required, for: .horizontal); d.setContentCompressionResistancePriority(.required, for: .horizontal)
            d.textAlignment = .right; d.widthAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
            let left = UIStackView(arrangedSubviews: [name, bars]); left.axis = .vertical; left.spacing = 6
            let h = UIStackView(arrangedSubviews: [left, d]); h.spacing = 14; h.alignment = .center
            return h

        case "stepper":
            let id = b.id ?? ""
            let minus = Lever.button(title: nil, symbol: "minus")
            let plus = Lever.button(title: nil, symbol: "plus")
            for (btn, ev) in [(minus, "minus"), (plus, "plus")] {
                btn.widthAnchor.constraint(equalToConstant: 52).isActive = true; btn.heightAnchor.constraint(equalToConstant: 52).isActive = true
                btn.addAction(UIAction { [weak self] _ in UISelectionFeedbackGenerator().selectionChanged(); self?.emit("tap", "\(id):\(ev)", nil) }, for: .touchUpInside)
            }
            minus.accessibilityLabel = "\(b.label ?? "") verringern"; plus.accessibilityLabel = "\(b.label ?? "") erhöhen"
            let val = label(b.value ?? "", .display(40, .heavy), .white, lines: 1); val.textAlignment = .center
            let cap = label((b.label ?? "").uppercased(), .body(11.5, .bold), Lever.muted, lines: 1); cap.textAlignment = .center
            let mid = UIStackView(arrangedSubviews: [val, cap]); mid.axis = .vertical; mid.spacing = 0
            let h = UIStackView(arrangedSubviews: [minus, mid, plus]); h.alignment = .center; h.spacing = 10
            return card(h, padding: 10)

        case "segmented":
            let seg = UISegmentedControl(items: (b.options ?? []).map { $0.title })
            seg.selectedSegmentIndex = (b.options ?? []).firstIndex { $0.id == b.selected } ?? 0
            seg.selectedSegmentTintColor = Lever.volt
            seg.setTitleTextAttributes([.foregroundColor: Lever.ink, .font: UIFont.display(17, .heavy)], for: .selected)
            seg.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.display(17, .heavy)], for: .normal)
            seg.heightAnchor.constraint(equalToConstant: 40).isActive = true
            let opts = b.options ?? []
            seg.addAction(UIAction { [weak self, weak seg] _ in
                guard let seg, seg.selectedSegmentIndex >= 0, seg.selectedSegmentIndex < opts.count else { return }
                self?.emit("tap", "\(b.id ?? ""):\(opts[seg.selectedSegmentIndex].id)", nil)
            }, for: .valueChanged)
            return seg

        case "field":
            let id = b.id ?? ""
            let box = FieldBox()
            let tv = fields[id] ?? {
                let tv = UITextView()
                tv.font = .body(16); tv.textColor = .white; tv.backgroundColor = .clear
                tv.isScrollEnabled = false; tv.textContainerInset = UIEdgeInsets(top: 12, left: 10, bottom: 12, right: 10)
                tv.delegate = self; tv.accessibilityIdentifier = id
                tv.text = b.value ?? ""
                fields[id] = tv
                return tv
            }()
            if !tv.isFirstResponder, let v = b.value, v != tv.text { tv.text = v }
            box.configure(label: b.label, placeholder: b.placeholder, text: tv)
            return box

        case "button":
            let btn = Lever.button(title: b.title, symbol: b.symbol, style: b.style ?? "glass", size: 16, display: b.style == "prominent")
            btn.heightAnchor.constraint(equalToConstant: 50).isActive = true
            btn.addAction(UIAction { [weak self] _ in self?.tapped(b.id ?? "") }, for: .touchUpInside)
            return btn

        case "buttons":
            let row = UIStackView(); row.axis = .horizontal; row.spacing = 10; row.distribution = .fillEqually
            for x in b.buttons ?? [] {
                let btn = Lever.button(title: x.title, symbol: x.symbol, style: x.style ?? "glass", size: 15)
                btn.heightAnchor.constraint(equalToConstant: 50).isActive = true
                btn.titleLabel?.numberOfLines = 2
                btn.addAction(UIAction { [weak self] _ in self?.tapped(x.id) }, for: .touchUpInside)
                row.addArrangedSubview(btn)
            }
            return row

        default: return nil
        }
    }

    func textViewDidBeginEditing(_ textView: UITextView) {
        if let sheet = sheetPresentationController, (spec.detents ?? []).contains("large") {
            sheet.animateChanges { sheet.selectedDetentIdentifier = .large }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in
            guard let self, let box = textView.superview else { return }
            self.scroll.scrollRectToVisible(box.convert(box.bounds, to: self.scroll).insetBy(dx: 0, dy: -12), animated: true)
        }
    }

    func textViewDidChange(_ textView: UITextView) {
        (textView.superview as? FieldBox)?.refreshPlaceholder()
        emit("text", textView.accessibilityIdentifier, textView.text ?? "")
        if #available(iOS 16.0, *) { sheetPresentationController?.invalidateDetents() }
    }
}

/// Mehrzeiliges Eingabefeld mit Beschriftung und Platzhalter
final class FieldBox: UIStackView {
    private let placeholder = UILabel()
    private weak var text: UITextView?
    func configure(label: String?, placeholder ph: String?, text tv: UITextView) {
        arrangedSubviews.forEach { $0.removeFromSuperview() }
        axis = .vertical; spacing = 6
        if let label {
            let l = UILabel(); l.text = label.uppercased(); l.font = .body(11.5, .bold); l.textColor = Lever.muted
            addArrangedSubview(l)
        }
        let bg = UIView(); bg.backgroundColor = UIColor(white: 0, alpha: 0.35)
        bg.layer.cornerRadius = 16; bg.layer.cornerCurve = .continuous; bg.layer.borderWidth = 1; bg.layer.borderColor = Lever.line.cgColor
        tv.removeFromSuperview(); tv.translatesAutoresizingMaskIntoConstraints = false
        bg.addSubview(tv)
        placeholder.text = ph; placeholder.font = .body(16); placeholder.textColor = UIColor(white: 1, alpha: 0.3)
        placeholder.translatesAutoresizingMaskIntoConstraints = false
        bg.addSubview(placeholder)
        NSLayoutConstraint.activate([
            tv.topAnchor.constraint(equalTo: bg.topAnchor), tv.bottomAnchor.constraint(equalTo: bg.bottomAnchor),
            tv.leadingAnchor.constraint(equalTo: bg.leadingAnchor), tv.trailingAnchor.constraint(equalTo: bg.trailingAnchor),
            tv.heightAnchor.constraint(greaterThanOrEqualToConstant: 68),
            placeholder.topAnchor.constraint(equalTo: bg.topAnchor, constant: 12), placeholder.leadingAnchor.constraint(equalTo: bg.leadingAnchor, constant: 15),
        ])
        addArrangedSubview(bg)
        text = tv
        refreshPlaceholder()
    }
    func refreshPlaceholder() { placeholder.isHidden = !(text?.text ?? "").isEmpty }
}

/// Label mit Innenabstand (Chips, Punkte)
final class PaddedLabel: UILabel {
    var insets = UIEdgeInsets(top: 5, left: 10, bottom: 5, right: 10)
    override func drawText(in rect: CGRect) { super.drawText(in: rect.inset(by: insets)) }
    override var intrinsicContentSize: CGSize {
        let s = super.intrinsicContentSize
        return CGSize(width: s.width + insets.left + insets.right, height: s.height + insets.top + insets.bottom)
    }
}

// MARK: - Erfassungs-Panel im Training

struct NPanelTile: Decodable { let n: Int; let text: String; let sub: String?; let state: String; let note: Bool? }
struct NPanelSpec: Decodable {
    let key: String                  // wechselt mit Übung/Satz → Notizfeld leeren
    let caption: String
    let value: String
    let unit: String?
    let weight: String?              // nil = kein Gewicht
    let seconds: Bool
    let timerPhase: String           // idle | prep | hold | done
    let timerLeft: Int?
    let timerShare: Double?
    let timerTitle: String?
    let primary: String              // save | timer
    let doneHint: String?
    let tiles: [NPanelTile]
    let canRemove: Bool
    let stateText: String?           // übersprungen / pausiert / alle erfasst
    let stateButton: String?
}

final class LeverSetPanel: UIViewController, UISheetPresentationControllerDelegate, UITextViewDelegate {
    var spec: NPanelSpec
    let emit: (String, Any?) -> Void
    static let small = UISheetPresentationController.Detent.Identifier("small")
    static let big = UISheetPresentationController.Detent.Identifier("big")

    private let root = UIStackView()
    private let scroll = UIScrollView()
    private let caption = UILabel()
    private let counter = UIStackView()
    private let value = UILabel()
    private let minus = Lever.button(title: nil, symbol: "minus", size: 24)
    private let plus = Lever.button(title: nil, symbol: "plus", size: 24)
    private let ring = HoldRing()
    private let weightRow = UIStackView()
    private let weightValue = UILabel()
    private let timerButton = Lever.button(title: "Timer starten", symbol: "timer")
    private let hint = UILabel()
    private let actions = UIStackView()
    private let noteButton = Lever.button(title: nil, symbol: "text.bubble", size: 20)
    private let saveButton = Lever.button(title: "Satz speichern", symbol: "checkmark", style: "prominent", size: 19, display: true)
    private let stateBox = UIStackView()
    private let stateLabel = UILabel()
    private let more = UIStackView()
    private let tiles = UIStackView()
    private let tileScroll = UIScrollView()
    private let note = UITextView()
    private let notePlaceholder = UILabel()
    private var essentialsHeight: CGFloat = 300

    init(spec: NPanelSpec, emit: @escaping (String, Any?) -> Void) {
        self.spec = spec; self.emit = emit
        super.init(nibName: nil, bundle: nil)
        overrideUserInterfaceStyle = .dark
        isModalInPresentation = true          // nicht wegwischbar – gehört zum Training
        if let sheet = sheetPresentationController {
            sheet.delegate = self
            sheet.prefersGrabberVisible = true
            sheet.detents = [
                .custom(identifier: Self.small) { [weak self] ctx in min(ctx.maximumDetentValue, self?.essentialsHeight ?? 300) },
                .custom(identifier: Self.big) { [weak self] ctx in min(ctx.maximumDetentValue, (self?.essentialsHeight ?? 300) + 236) },
            ]
            sheet.largestUndimmedDetentIdentifier = Self.big   // Training dahinter bleibt bedienbar
            sheet.selectedDetentIdentifier = Self.small
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        }
    }
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        if #unavailable(iOS 26.0) { view.backgroundColor = UIColor(white: 0.1, alpha: 1) }
        root.axis = .vertical; root.spacing = 14; root.translatesAutoresizingMaskIntoConstraints = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.showsVerticalScrollIndicator = false; scroll.keyboardDismissMode = .interactive
        scroll.isScrollEnabled = false          // nur beim Tippen nötig
        view.addSubview(scroll); scroll.addSubview(root)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            root.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 26),
            root.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -16),
            root.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 20),
            root.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -20),
        ])

        caption.font = .body(12, .bold); caption.textColor = Lever.muted; caption.textAlignment = .center
        root.addArrangedSubview(caption)

        value.font = .display(104, .black); value.textColor = .white; value.textAlignment = .center
        value.adjustsFontSizeToFitWidth = true; value.minimumScaleFactor = 0.6
        for (b, ev) in [(minus, "minus"), (plus, "plus")] {
            b.widthAnchor.constraint(equalToConstant: 72).isActive = true; b.heightAnchor.constraint(equalToConstant: 72).isActive = true
            b.addAction(UIAction { [weak self] _ in UISelectionFeedbackGenerator().selectionChanged(); self?.emit(ev, nil) }, for: .touchUpInside)
        }
        minus.accessibilityLabel = "weniger"; plus.accessibilityLabel = "mehr"
        counter.axis = .horizontal; counter.alignment = .center; counter.distribution = .equalCentering
        counter.addArrangedSubview(minus); counter.addArrangedSubview(value); counter.addArrangedSubview(plus)
        root.addArrangedSubview(counter)
        ring.heightAnchor.constraint(equalToConstant: 196).isActive = true
        root.addArrangedSubview(ring)

        let wl = UILabel(); wl.text = "Zusatzgewicht"; wl.font = .body(15, .semibold); wl.textColor = Lever.muted
        let wm = Lever.button(title: nil, symbol: "minus"), wp = Lever.button(title: nil, symbol: "plus")
        for (b, ev) in [(wm, "wminus"), (wp, "wplus")] {
            b.widthAnchor.constraint(equalToConstant: 46).isActive = true; b.heightAnchor.constraint(equalToConstant: 46).isActive = true
            b.addAction(UIAction { [weak self] _ in UISelectionFeedbackGenerator().selectionChanged(); self?.emit(ev, nil) }, for: .touchUpInside)
        }
        wm.accessibilityLabel = "2,5 kg weniger"; wp.accessibilityLabel = "2,5 kg mehr"
        weightValue.font = .display(26, .heavy); weightValue.textColor = .white; weightValue.textAlignment = .center
        weightValue.widthAnchor.constraint(equalToConstant: 84).isActive = true
        weightRow.axis = .horizontal; weightRow.alignment = .center; weightRow.spacing = 8
        weightRow.addArrangedSubview(wl); weightRow.addArrangedSubview(UIView())
        weightRow.addArrangedSubview(wm); weightRow.addArrangedSubview(weightValue); weightRow.addArrangedSubview(wp)
        root.addArrangedSubview(weightRow)

        timerButton.heightAnchor.constraint(equalToConstant: 58).isActive = true
        timerButton.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            let timing = self.spec.timerPhase == "prep" || self.spec.timerPhase == "hold"
            self.emit(timing ? "cancel" : "timer", nil)
        }, for: .touchUpInside)
        root.addArrangedSubview(timerButton)
        hint.font = .body(14, .bold); hint.textColor = Lever.volt; hint.textAlignment = .center
        root.addArrangedSubview(hint)

        actions.axis = .horizontal; actions.spacing = 10
        noteButton.widthAnchor.constraint(equalToConstant: 64).isActive = true
        noteButton.heightAnchor.constraint(equalToConstant: 64).isActive = true
        noteButton.accessibilityLabel = "Notiz zu diesem Satz"
        noteButton.addAction(UIAction { [weak self] _ in self?.toggleBig() }, for: .touchUpInside)
        saveButton.heightAnchor.constraint(equalToConstant: 64).isActive = true
        saveButton.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            self.emit("save", self.note.text ?? "")
            self.note.text = ""; self.notePlaceholder.isHidden = false
            self.restyleNote()
        }, for: .touchUpInside)
        actions.addArrangedSubview(noteButton); actions.addArrangedSubview(saveButton)
        root.addArrangedSubview(actions)

        stateLabel.font = .body(16); stateLabel.textColor = Lever.muted; stateLabel.numberOfLines = 0; stateLabel.textAlignment = .center
        stateBox.axis = .vertical; stateBox.spacing = 12
        stateBox.addArrangedSubview(stateLabel)
        root.addArrangedSubview(stateBox)

        // ausgeklappt: Satz-Kacheln und Notiz
        more.axis = .vertical; more.spacing = 8
        let tl = UILabel(); tl.text = "SÄTZE"; tl.font = .body(11.5, .bold); tl.textColor = Lever.muted
        // Sätze als Kreise in einer waagrechten Reihe (scrollt, wenn es mehr werden)
        tiles.axis = .horizontal; tiles.spacing = 8; tiles.alignment = .center
        tiles.translatesAutoresizingMaskIntoConstraints = false
        tileScroll.showsHorizontalScrollIndicator = false; tileScroll.clipsToBounds = false
        tileScroll.addSubview(tiles)
        NSLayoutConstraint.activate([
            tiles.topAnchor.constraint(equalTo: tileScroll.contentLayoutGuide.topAnchor),
            tiles.bottomAnchor.constraint(equalTo: tileScroll.contentLayoutGuide.bottomAnchor),
            tiles.leadingAnchor.constraint(equalTo: tileScroll.contentLayoutGuide.leadingAnchor),
            tiles.trailingAnchor.constraint(equalTo: tileScroll.contentLayoutGuide.trailingAnchor),
            tiles.heightAnchor.constraint(equalTo: tileScroll.frameLayoutGuide.heightAnchor),
            tileScroll.heightAnchor.constraint(equalToConstant: SetCircle.size),
        ])
        let nl = UILabel(); nl.text = "NOTIZ ZU DIESEM SATZ"; nl.font = .body(11.5, .bold); nl.textColor = Lever.muted
        let bg = UIView(); bg.backgroundColor = UIColor(white: 0, alpha: 0.35); bg.layer.cornerRadius = 16; bg.layer.borderWidth = 1; bg.layer.borderColor = Lever.line.cgColor
        note.font = .body(16); note.textColor = .white; note.backgroundColor = .clear; note.delegate = self
        note.textContainerInset = UIEdgeInsets(top: 12, left: 10, bottom: 12, right: 10)
        note.translatesAutoresizingMaskIntoConstraints = false; bg.addSubview(note)
        notePlaceholder.text = "z. B. Ellenbogen gezwickt"; notePlaceholder.font = .body(16); notePlaceholder.textColor = UIColor(white: 1, alpha: 0.3)
        notePlaceholder.translatesAutoresizingMaskIntoConstraints = false; bg.addSubview(notePlaceholder)
        NSLayoutConstraint.activate([
            note.topAnchor.constraint(equalTo: bg.topAnchor), note.bottomAnchor.constraint(equalTo: bg.bottomAnchor),
            note.leadingAnchor.constraint(equalTo: bg.leadingAnchor), note.trailingAnchor.constraint(equalTo: bg.trailingAnchor),
            bg.heightAnchor.constraint(equalToConstant: 76),
            notePlaceholder.topAnchor.constraint(equalTo: bg.topAnchor, constant: 12), notePlaceholder.leadingAnchor.constraint(equalTo: bg.leadingAnchor, constant: 15),
        ])
        more.addArrangedSubview(tl); more.addArrangedSubview(tileScroll)
        more.setCustomSpacing(16, after: tileScroll)
        more.addArrangedSubview(nl); more.addArrangedSubview(bg)
        root.setCustomSpacing(44, after: actions)
        root.addArrangedSubview(more)

        apply(spec, first: true)
    }

    func apply(_ s: NPanelSpec, first: Bool = false) {
        let keyChanged = s.key != spec.key
        spec = s
        caption.text = s.caption.uppercased()
        let timing = s.timerPhase == "prep" || s.timerPhase == "hold"
        let inState = s.stateText != nil
        value.attributedText = {
            let a = NSMutableAttributedString(string: s.value, attributes: [.font: UIFont.display(104, .black), .foregroundColor: UIColor.white])
            if let u = s.unit { a.append(NSAttributedString(string: u, attributes: [.font: UIFont.display(30, .heavy), .foregroundColor: Lever.muted])) }
            return a
        }()
        counter.isHidden = timing || inState
        caption.isHidden = inState
        ring.isHidden = !timing
        if timing { ring.set(left: s.timerLeft ?? 0, share: s.timerShare ?? 0, prep: s.timerPhase == "prep") }
        weightRow.isHidden = s.weight == nil || timing || inState
        weightValue.text = s.weight.map { "\($0) kg" }

        // Timer-Button: bis der Timer durch ist Hauptaktion (Volt), sonst Glas
        timerButton.isHidden = !s.seconds || inState
        if s.seconds {
            Lever.restyle(timerButton, title: s.timerTitle ?? "Timer starten", symbol: timing ? "xmark" : "timer",
                          style: !timing && s.primary == "timer" ? "prominent" : "glass", size: 18, display: true)
        }
        hint.text = s.doneHint; hint.isHidden = s.doneHint == nil || inState

        // Aktionen: Notiz + Speichern
        actions.isHidden = inState
        restyleNote()
        Lever.restyle(saveButton, title: "Satz speichern", symbol: "checkmark", style: s.primary == "save" ? "prominent" : "glass", size: 19, display: true)

        // Zustand statt Erfassung (übersprungen, pausiert, alles erfasst)
        stateBox.isHidden = !inState
        stateLabel.text = s.stateText
        stateBox.arrangedSubviews.dropFirst().forEach { $0.removeFromSuperview() }
        if let t = s.stateButton {
            let b = Lever.button(title: t, symbol: "arrow.uturn.backward", size: 16)
            b.heightAnchor.constraint(equalToConstant: 52).isActive = true
            b.addAction(UIAction { [weak self] _ in self?.emit("state", nil) }, for: .touchUpInside)
            stateBox.addArrangedSubview(b)
        }

        // Satz-Kacheln
        tiles.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for tile in s.tiles {
            let c = SetCircle(tile)
            c.addAction(UIAction { [weak self] _ in self?.emit("tile", tile.n) }, for: .touchUpInside)
            tiles.addArrangedSubview(c)
        }
        if s.canRemove {
            let r = Lever.button(title: nil, symbol: "minus", size: 15)
            r.widthAnchor.constraint(equalToConstant: SetCircle.size).isActive = true; r.heightAnchor.constraint(equalToConstant: SetCircle.size).isActive = true
            r.accessibilityLabel = "Einen Satz weniger"
            r.addAction(UIAction { [weak self] _ in self?.emit("remove", nil) }, for: .touchUpInside)
            tiles.addArrangedSubview(r)
        }
        let a = Lever.button(title: nil, symbol: "plus", size: 15)
        a.widthAnchor.constraint(equalToConstant: SetCircle.size).isActive = true; a.heightAnchor.constraint(equalToConstant: SetCircle.size).isActive = true
        a.accessibilityLabel = "Einen Satz mehr"
        a.addAction(UIAction { [weak self] _ in self?.emit("add", nil) }, for: .touchUpInside)
        tiles.addArrangedSubview(a)

        if keyChanged && !first { note.text = ""; notePlaceholder.isHidden = false }
        relayout()
    }

    private func restyleNote() {
        let on = !(note.text ?? "").isEmpty
        Lever.restyle(noteButton, title: nil, symbol: on ? "text.bubble.fill" : "text.bubble", size: 20)
        if on { noteButton.configuration?.baseForegroundColor = Lever.volt }
        noteButton.accessibilityLabel = "Notiz zu diesem Satz"
    }

    private func toggleBig() {
        guard let sheet = sheetPresentationController else { return }
        let toBig = sheet.selectedDetentIdentifier != Self.big
        sheet.animateChanges { sheet.selectedDetentIdentifier = toBig ? Self.big : Self.small }
        if toBig { note.becomeFirstResponder() }
    }

    /// Höhe der eingeklappten Stufe = alles bis einschließlich der Aktionen
    private func relayout() {
        view.layoutIfNeeded()
        let last: UIView = !stateBox.isHidden ? stateBox : actions
        // Detent-Höhen zählen ohne den unteren Sicherheitsabstand – den rechnet iOS selbst dazu
        let h = 26 + last.frame.maxY + 6
        if abs(h - essentialsHeight) > 1, h > 120 {
            essentialsHeight = h
            if #available(iOS 16.0, *) { sheetPresentationController?.animateChanges { sheetPresentationController?.invalidateDetents() } }
            emit("height", Double(h))
        }
    }

    override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); relayout() }

    func textViewDidChange(_ textView: UITextView) {
        notePlaceholder.isHidden = !(textView.text ?? "").isEmpty
        restyleNote()
    }

    /// Tippen in die Notiz: Sheet ganz hoch, Inhalt scrollbar, Feld über die Tastatur holen
    func textViewDidBeginEditing(_ textView: UITextView) {
        guard let sheet = sheetPresentationController else { return }
        scroll.isScrollEnabled = true
        sheet.animateChanges {
            sheet.detents = sheet.detents + [.large()]
            sheet.selectedDetentIdentifier = .large
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in
            guard let self else { return }
            let r = self.note.superview?.convert(self.note.superview?.bounds ?? .zero, to: self.scroll) ?? .zero
            self.scroll.scrollRectToVisible(r.insetBy(dx: 0, dy: -12), animated: true)
        }
    }
    func textViewDidEndEditing(_ textView: UITextView) {
        guard let sheet = sheetPresentationController else { return }
        scroll.isScrollEnabled = false
        scroll.setContentOffset(.zero, animated: true)
        sheet.animateChanges {
            sheet.detents = sheet.detents.filter { $0.identifier != .large }
            if sheet.selectedDetentIdentifier == .large || sheet.selectedDetentIdentifier == nil { sheet.selectedDetentIdentifier = Self.big }
        }
    }

    func sheetPresentationControllerDidChangeSelectedDetentIdentifier(_ sheet: UISheetPresentationController) {
        if sheet.selectedDetentIdentifier == Self.small { note.resignFirstResponder() }
    }
}

/// Satz als Kreis: erledigt = Kreideweiß mit dunkler Zahl (bei Zusatzgewicht zweizeilig),
/// aktueller Satz = Volt-Ring, offen = dezente Fläche mit Satznummer. Notiz = Volt-Punkt.
final class SetCircle: UIControl {
    static let size: CGFloat = 50
    init(_ t: NPanelTile) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        widthAnchor.constraint(equalToConstant: Self.size).isActive = true
        heightAnchor.constraint(equalToConstant: Self.size).isActive = true
        layer.cornerRadius = Self.size / 2
        let done = t.state == "done", current = t.state == "current"
        backgroundColor = done ? UIColor(white: 0.95, alpha: 1) : UIColor(white: 1, alpha: current ? 0.1 : 0.07)
        layer.borderWidth = done ? 0 : current ? 2.5 : 1
        layer.borderColor = (current ? Lever.volt : UIColor(white: 1, alpha: 0.16)).cgColor
        let value = UILabel()
        value.text = done ? t.text : String(t.n)
        value.font = .display(done ? (t.sub == nil ? 22 : 19) : 19, .heavy)
        value.textColor = done ? Lever.ink : current ? Lever.volt : UIColor(white: 1, alpha: 0.45)
        value.textAlignment = .center
        let col = UIStackView(arrangedSubviews: [value]); col.axis = .vertical; col.alignment = .center; col.spacing = -3
        if done, let sub = t.sub {
            let w = UILabel(); w.text = sub; w.font = .body(11, .bold); w.textColor = UIColor(white: 0.06, alpha: 0.7)
            col.addArrangedSubview(w)
        }
        col.isUserInteractionEnabled = false; col.translatesAutoresizingMaskIntoConstraints = false
        addSubview(col)
        NSLayoutConstraint.activate([col.centerXAnchor.constraint(equalTo: centerXAnchor), col.centerYAnchor.constraint(equalTo: centerYAnchor)])
        if t.note == true {
            let dot = UIView(); dot.backgroundColor = Lever.volt; dot.layer.cornerRadius = 4.5
            dot.layer.borderWidth = 2; dot.layer.borderColor = UIColor(white: 0.12, alpha: 1).cgColor
            dot.translatesAutoresizingMaskIntoConstraints = false; dot.isUserInteractionEnabled = false
            addSubview(dot)
            NSLayoutConstraint.activate([dot.widthAnchor.constraint(equalToConstant: 9), dot.heightAnchor.constraint(equalToConstant: 9),
                                         dot.topAnchor.constraint(equalTo: topAnchor, constant: 2), dot.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -2)])
        }
        isAccessibilityElement = true
        accessibilityTraits = .button
        accessibilityLabel = done ? "Satz \(t.n): \(t.text)\(t.sub.map { " \($0) kg" } ?? "") – ändern" : "Satz \(t.n) erfassen"
    }
    required init?(coder: NSCoder) { fatalError() }
    override var isHighlighted: Bool { didSet { UIView.animate(withDuration: 0.12) { self.transform = self.isHighlighted ? CGAffineTransform(scaleX: 0.92, y: 0.92) : .identity } } }
}

/// Ring für den Halte-Timer: läuft flüssig (Anteil kommt 10×/s, dazwischen animiert)
final class HoldRing: UIView {
    private let track = CAShapeLayer(), arc = CAShapeLayer()
    private let number = UILabel(), sub = UILabel()
    override init(frame: CGRect) {
        super.init(frame: frame)
        for l in [track, arc] { l.fillColor = UIColor.clear.cgColor; l.lineWidth = 14; l.lineCap = .round; layer.addSublayer(l) }
        track.strokeColor = UIColor(white: 1, alpha: 0.08).cgColor
        number.font = .display(84, .black); number.textAlignment = .center
        sub.font = .body(13, .bold); sub.textColor = Lever.muted; sub.textAlignment = .center
        let v = UIStackView(arrangedSubviews: [number, sub]); v.axis = .vertical; v.spacing = 0; v.translatesAutoresizingMaskIntoConstraints = false
        addSubview(v)
        NSLayoutConstraint.activate([v.centerXAnchor.constraint(equalTo: centerXAnchor), v.centerYAnchor.constraint(equalTo: centerYAnchor)])
    }
    required init?(coder: NSCoder) { fatalError() }
    override func layoutSubviews() {
        super.layoutSubviews()
        let r = min(bounds.width, bounds.height) / 2 - 8
        let path = UIBezierPath(arcCenter: CGPoint(x: bounds.midX, y: bounds.midY), radius: r, startAngle: -.pi / 2, endAngle: 1.5 * .pi, clockwise: true)
        track.path = path.cgPath; arc.path = path.cgPath
    }
    func set(left: Int, share: Double, prep: Bool) {
        number.text = "\(left)"
        number.textColor = prep ? .white : Lever.volt
        sub.text = prep ? "IN POSITION" : "HALTEN!"
        sub.textColor = prep ? .white : Lever.muted
        arc.strokeColor = (prep ? UIColor.white : Lever.volt).cgColor
        CATransaction.begin(); CATransaction.setAnimationDuration(0.1); CATransaction.setAnimationTimingFunction(.init(name: .linear))
        arc.strokeEnd = CGFloat(max(0, min(1, share)))
        CATransaction.commit()
    }
}

// MARK: - Plugin-Methoden

extension LeverTabBarPlugin {
    private static var sheets: [String: LeverNativeSheet] = [:]
    private static var panel: LeverSetPanel?
    /// Panel, das erst nach dem Schließen des Pausen-Screens erscheinen darf
    static var pendingPanel: NPanelSpec?

    private func topController() -> UIViewController? {
        guard var top: UIViewController = tabsRef else { return nil }
        while let p = top.presentedViewController, !p.isBeingDismissed { top = p }
        return top
    }

    /// Ganz oben präsentieren – läuft gerade ein Ein-/Ausblenden, kurz warten (sonst verweigert
    /// UIKit das Präsentieren still, und Ebenen landen in falscher Reihenfolge)
    func presentOnTop(_ vc: UIViewController, tries: Int = 8) {
        guard let top = topController() else { return }
        let busy = top.isBeingPresented || top.isBeingDismissed || (top.presentedViewController?.isBeingDismissed ?? false)
        if busy && tries > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in self?.presentOnTop(vc, tries: tries - 1) }
            return
        }
        top.present(vc, animated: true)
    }

    /// Sheet zeigen – oder, wenn eines mit gleicher id offen ist, an Ort und Stelle aktualisieren
    @objc func showSheet(_ call: CAPPluginCall) {
        guard let spec = decode(NSheetSpec.self, call.getObject("spec")) else { call.reject("Sheet unlesbar"); return }
        DispatchQueue.main.async {
            if let open = Self.sheets[spec.id], open.presentingViewController != nil { open.update(spec); call.resolve(); return }
            let vc = LeverNativeSheet(spec: spec) { [weak self] type, id, value in
                if type == "dismiss" { Self.sheets[spec.id] = nil }
                var data: [String: Any] = ["sheet": spec.id, "type": type]
                if let id { data["id"] = id }
                if let value { data["value"] = value }
                self?.notifyListeners("sheet", data: data)
            }
            Self.sheets[spec.id] = vc
            guard let top = self.topController() else { call.reject("Kein Controller"); return }
            top.present(vc, animated: true)
            call.resolve()
        }
    }

    @objc func closeSheet(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        DispatchQueue.main.async {
            if let vc = Self.sheets.removeValue(forKey: id) {
                vc.closedByApp = true
                // was darüber liegt (z. B. eine Rückfrage), schließt mit
                vc.presentingViewController?.dismiss(animated: true)
            }
            call.resolve()
        }
    }

    /// Erfassungs-Panel im Training: spec = null schließt es
    @objc func setPanel(_ call: CAPPluginCall) {
        let spec = decode(NPanelSpec.self, call.getObject("spec"))
        DispatchQueue.main.async {
            if let spec {
                if let p = Self.panel, p.presentingViewController != nil { p.apply(spec); call.resolve(); return }
                // Pausen-Screen noch offen (oder schließt gerade): sonst hinge das Panel an ihm und ginge mit
                if Self.restOpen { Self.pendingPanel = spec; call.resolve(); return }
                self.presentPanel(spec)
            } else {
                Self.pendingPanel = nil
                if let p = Self.panel {
                    Self.panel = nil
                    p.presentingViewController?.dismiss(animated: true)
                }
            }
            call.resolve()
        }
    }

    func presentPanel(_ spec: NPanelSpec) {
                let p = LeverSetPanel(spec: spec) { [weak self] type, value in
                    var data: [String: Any] = ["type": type]
                    if let value { data["value"] = value }
                    self?.notifyListeners("panel", data: data)
                }
                Self.panel = p
                presentOnTop(p)
    }
}


// MARK: - Pausen-Screen (nativ, Vollbild-Sheet)

struct NRest: Decodable {
    let end: Double?        // Endzeitpunkt in ms seit 1970 (nil = abgelaufen)
    let total: Double       // Länge in s (für den Ring)
    let ringing: Bool
    let saved: String?      // „6 Wdh. · +1 zum letzten Mal“
    let nextTitle: String?
    let nextSubtitle: String?
    let nextClip: String?
}

/// Standbild aus einem Clip im App-Paket (Schlüsselposition nach 1 s), zwischengespeichert
enum ClipStill {
    private static var cache: [String: UIImage] = [:]
    static func load(_ id: String, done: @escaping (UIImage?) -> Void) {
        if let img = cache[id] { done(img); return }
        guard let url = Bundle.main.resourceURL?.appendingPathComponent("public/clips/\(id).mp4"),
              FileManager.default.fileExists(atPath: url.path) else { done(nil); return }
        let gen = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        gen.appliesPreferredTrackTransform = true
        gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
        gen.maximumSize = CGSize(width: 480, height: 360)
        gen.generateCGImageAsynchronously(for: CMTime(seconds: 1, preferredTimescale: 600)) { cg, _, _ in
            // quadratischer Ausschnitt um die Bildmitte – die Figur füllt das Vorschaubild
            let img = cg.map { c -> UIImage in
                let side = CGFloat(c.height) * 0.8
                let rect = CGRect(x: (CGFloat(c.width) - side) / 2, y: CGFloat(c.height) * 0.06, width: side, height: side)
                return UIImage(cgImage: c.cropping(to: rect) ?? c)
            }
            DispatchQueue.main.async { if let img { cache[id] = img }; done(img) }
        }
    }
}

/// Ring und Countdown laufen hier selbst (CADisplayLink) – flüssig, ohne Web-Takt.
final class LeverRestController: UIViewController, UISheetPresentationControllerDelegate {
    var spec: NRest
    let emit: (String) -> Void
    var closedByApp = false
    private let ringTrack = CAShapeLayer(), ringArc = CAShapeLayer()
    private let ringView = UIView()
    private let time = UILabel(), of = UILabel(), head = UILabel()
    private let saved = PaddedLabel()
    private let minus = Lever.button(title: "−15 s", style: "glass", size: 20, display: true, upper: false)
    private let plus = Lever.button(title: "+30 s", style: "glass", size: 20, display: true, upper: false)
    private let go = Lever.button(title: "Los", symbol: "forward.end.fill", style: "prominent", size: 18, display: true)
    private let nextBox = UIStackView()
    private var link: CADisplayLink?

    init(spec: NRest, emit: @escaping (String) -> Void) {
        self.spec = spec; self.emit = emit
        super.init(nibName: nil, bundle: nil)
        overrideUserInterfaceStyle = .dark
        if let sheet = sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
            sheet.delegate = self
        }
    }
    required init?(coder: NSCoder) { fatalError() }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { if !closedByApp { emit("close") } }
    var onGone: (() -> Void)?
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated); link?.invalidate(); link = nil
        if isBeingDismissed || presentingViewController == nil { onGone?() }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if #unavailable(iOS 26.0) { view.backgroundColor = UIColor(white: 0.08, alpha: 1) }
        head.font = .body(13, .bold); head.textColor = Lever.muted; head.textAlignment = .center
        saved.font = .display(19, .heavy); saved.textColor = Lever.ink; saved.backgroundColor = UIColor(white: 0.95, alpha: 1)
        saved.layer.cornerRadius = 19; saved.clipsToBounds = true; saved.insets = UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)

        for l in [ringTrack, ringArc] { l.fillColor = UIColor.clear.cgColor; l.lineWidth = 18; l.lineCap = .round; ringView.layer.addSublayer(l) }
        ringTrack.strokeColor = UIColor(white: 1, alpha: 0.08).cgColor
        ringArc.strokeColor = Lever.volt.cgColor
        time.font = .display(92, .black); time.textColor = .white; time.textAlignment = .center
        time.adjustsFontSizeToFitWidth = true; time.minimumScaleFactor = 0.6
        of.font = .body(15, .semibold); of.textColor = Lever.muted; of.textAlignment = .center
        let center = UIStackView(arrangedSubviews: [time, of]); center.axis = .vertical; center.alignment = .center; center.spacing = -6
        center.translatesAutoresizingMaskIntoConstraints = false
        ringView.addSubview(center)
        ringView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            ringView.widthAnchor.constraint(equalToConstant: 280), ringView.heightAnchor.constraint(equalToConstant: 280),
            center.centerXAnchor.constraint(equalTo: ringView.centerXAnchor), center.centerYAnchor.constraint(equalTo: ringView.centerYAnchor),
            center.widthAnchor.constraint(lessThanOrEqualToConstant: 220),
        ])

        for (b, ev) in [(minus, "minus"), (plus, "plus"), (go, "go")] {
            b.heightAnchor.constraint(equalToConstant: 58).isActive = true
            b.addAction(UIAction { [weak self] _ in UIImpactFeedbackGenerator(style: .light).impactOccurred(); self?.emit(ev) }, for: .touchUpInside)
        }
        let row = UIStackView(arrangedSubviews: [minus, plus, go]); row.spacing = 10; row.distribution = .fillEqually

        nextBox.axis = .horizontal; nextBox.spacing = 14; nextBox.alignment = .center
        nextBox.isLayoutMarginsRelativeArrangement = true; nextBox.layoutMargins = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 18)
        nextBox.backgroundColor = UIColor(white: 1, alpha: 0.06); nextBox.layer.cornerRadius = 22; nextBox.layer.cornerCurve = .continuous
        nextBox.layer.borderWidth = 1; nextBox.layer.borderColor = Lever.line.cgColor
        let nextTap = UITapGestureRecognizer(target: self, action: #selector(nextTapped)); nextBox.addGestureRecognizer(nextTap)

        let back = Lever.button(title: "Zurück zur Übung, Timer läuft weiter", style: "glass", size: 16)
        back.heightAnchor.constraint(equalToConstant: 52).isActive = true
        back.addAction(UIAction { [weak self] _ in self?.emit("close") }, for: .touchUpInside)

        let top = UIStackView(arrangedSubviews: [head, saved]); top.axis = .vertical; top.alignment = .center; top.spacing = 12
        let stack = UIStackView(arrangedSubviews: [top, ringView, row, UIView(), nextBox, back])
        stack.axis = .vertical; stack.alignment = .fill; stack.spacing = 22
        stack.setCustomSpacing(30, after: top)
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        let ringWrap = stack.arrangedSubviews[1]
        stack.removeArrangedSubview(ringWrap)
        let holder = UIView(); holder.addSubview(ringView)
        NSLayoutConstraint.activate([ringView.centerXAnchor.constraint(equalTo: holder.centerXAnchor), ringView.topAnchor.constraint(equalTo: holder.topAnchor),
                                     ringView.bottomAnchor.constraint(equalTo: holder.bottomAnchor)])
        stack.insertArrangedSubview(holder, at: 1)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 34),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -22),
            stack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
        ])
        apply(spec)
        link = CADisplayLink(target: self, selector: #selector(tick)); link?.add(to: .main, forMode: .common)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let r = ringView.bounds.width / 2 - 10
        let path = UIBezierPath(arcCenter: CGPoint(x: ringView.bounds.midX, y: ringView.bounds.midY), radius: r, startAngle: -.pi / 2, endAngle: 1.5 * .pi, clockwise: true)
        ringTrack.path = path.cgPath; ringArc.path = path.cgPath
    }


    @objc private func nextTapped() { emit("close") }

    func apply(_ s: NRest) {
        spec = s
        head.text = s.ringing || s.end == nil ? "PAUSE VORBEI" : "PAUSE"
        saved.isHidden = (s.saved ?? "").isEmpty
        saved.text = s.saved.map { "✓  \($0)" }
        of.text = "von \(Self.clock(s.total))"
        minus.isEnabled = s.end != nil; plus.isEnabled = s.end != nil
        nextBox.arrangedSubviews.forEach { $0.removeFromSuperview() }
        nextBox.isHidden = s.nextTitle == nil
        if let t = s.nextTitle {
            let cap = UILabel(); cap.text = "ALS NÄCHSTES"; cap.font = .body(11.5, .bold); cap.textColor = Lever.muted
            let title = UILabel(); title.text = t.uppercased(); title.font = .display(26, .heavy); title.textColor = .white
            let sub = UILabel(); sub.text = s.nextSubtitle; sub.font = .body(14); sub.textColor = Lever.muted; sub.numberOfLines = 2
            let v = UIStackView(arrangedSubviews: [cap, title, sub]); v.axis = .vertical; v.spacing = 2
            let chev = UIImageView(image: UIImage(systemName: "chevron.right")); chev.tintColor = Lever.muted
            chev.setContentHuggingPriority(.required, for: .horizontal)
            if let clip = s.nextClip {
                let thumb = UIImageView(); thumb.contentMode = .scaleAspectFill; thumb.clipsToBounds = true
                thumb.layer.cornerRadius = 14; thumb.layer.cornerCurve = .continuous
                thumb.backgroundColor = UIColor(white: 1, alpha: 0.04)
                thumb.widthAnchor.constraint(equalToConstant: 104).isActive = true
                thumb.heightAnchor.constraint(equalToConstant: 104).isActive = true
                nextBox.addArrangedSubview(thumb)
                ClipStill.load(clip) { [weak thumb] img in thumb?.image = img; thumb?.isHidden = img == nil }
            }
            nextBox.addArrangedSubview(v); nextBox.addArrangedSubview(chev)
        }
        tick()
    }

    @objc private func tick() {
        let now = Date().timeIntervalSince1970 * 1000
        let left = spec.end.map { Swift.max(0, $0 - now) } ?? 0
        let share = spec.total > 0 ? left / (spec.total * 1000) : 0
        CATransaction.begin(); CATransaction.setDisableActions(true)
        ringArc.strokeEnd = CGFloat(Swift.min(1, share))
        CATransaction.commit()
        let txt = spec.ringing || spec.end == nil ? "Los!" : Self.clock(ceil(left / 1000))
        if time.text != txt { time.text = txt }
        time.textColor = spec.ringing ? Lever.volt : .white
    }

    static func clock(_ s: Double) -> String { let v = Int(s); return "\(v / 60):" + String(format: "%02d", v % 60) }
}

extension LeverTabBarPlugin {
    private static var rest: LeverRestController?
    /// nur wenn wirklich sichtbar – ein weggewischter Pausen-Screen zählt nicht
    static var restOpen: Bool { rest?.presentingViewController != nil && rest?.isBeingDismissed == false }

    /// Pausen-Screen: spec = null schließt
    @objc func setRest(_ call: CAPPluginCall) {
        let obj = call.getObject("spec")
        let spec: NRest? = {
            guard let obj, JSONSerialization.isValidJSONObject(obj), let d = try? JSONSerialization.data(withJSONObject: obj) else { return nil }
            return try? JSONDecoder().decode(NRest.self, from: d)
        }()
        DispatchQueue.main.async {
            if let spec {
                if let r = Self.rest, r.presentingViewController != nil { r.apply(spec); call.resolve(); return }
                let r = LeverRestController(spec: spec) { [weak self] ev in
                    if ev == "close" { Self.rest = nil }     // vom Nutzer weggewischt
                    self?.notifyListeners("rest", data: ["type": ev])
                }
                Self.rest = r
                // liegt über dem Erfassungs-Panel; das bleibt darunter und ist nach der Pause sofort da
                self.presentOnTop(r)
            } else if let r = Self.rest {
                Self.rest = nil
                r.closedByApp = true
                let after = { [weak self] in
                    if let p = Self.pendingPanel { Self.pendingPanel = nil; self?.presentPanel(p) }
                }
                if let presenter = r.presentingViewController { presenter.dismiss(animated: true, completion: after) } else { after() }
            }
            call.resolve()
        }
    }
}
