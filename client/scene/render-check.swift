import AppKit
import Foundation

let modes = ["project-1", "project-3", "project-5", "project-7", "project-15", "away-3", "away-7", "away-15", "all", "transition-start", "transition-away", "transition-return", "empty"]
var images: [String: NSImage] = [:]
func color(_ value: String, _ alpha: Double) -> NSColor {
    let hex = String(value.dropFirst())
    let n = Int(hex, radix: 16) ?? 0
    return NSColor(calibratedRed: CGFloat((n >> 16) & 255) / 255,
                   green: CGFloat((n >> 8) & 255) / 255,
                   blue: CGFloat(n & 255) / 255, alpha: alpha)
}
func num(_ a: [Any], _ i: Int) -> CGFloat { CGFloat((a[i] as? NSNumber)?.doubleValue ?? 0) }
for mode in modes {
    let data = try Data(contentsOf: URL(fileURLWithPath: "/tmp/scene-\(mode).json"))
    let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    let width = json["width"] as! Int, height = json["height"] as! Int
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
      bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
      colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    let gc = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = gc
    let cg = gc.cgContext
    cg.translateBy(x: 0, y: CGFloat(height)); cg.scaleBy(x: 1, y: -1)
    cg.interpolationQuality = .none
    for command in json["commands"] as! [[Any]] {
        let kind = command[0] as! String
        if kind == "save" { cg.saveGState(); continue }
        if kind == "restore" { cg.restoreGState(); continue }
        if kind == "translate" { cg.translateBy(x:num(command,1),y:num(command,2)); continue }
        if kind == "rotate" { cg.rotate(by:num(command,1)); continue }
        if kind == "scale" { cg.scaleBy(x:num(command,1),y:num(command,2)); continue }
        if kind == "image" {
            let alpha = num(command, 1), path = command[2] as! String
            if images[path] == nil { images[path] = NSImage(contentsOfFile: path) }
            guard let image = images[path], let source = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
            let target = CGRect(x:num(command,3), y:num(command,4), width:num(command,5), height:num(command,6))
            cg.saveGState(); cg.setAlpha(alpha)
            cg.translateBy(x: target.minX, y: target.maxY); cg.scaleBy(x: 1, y: -1)
            cg.draw(source, in: CGRect(x:0, y:0, width:target.width, height:target.height))
            cg.restoreGState()
        } else if kind == "rect" || kind == "stroke" {
            let c = color(command[1] as! String, Double(num(command,2)))
            let rect = CGRect(x:num(command,3), y:num(command,4), width:num(command,5), height:num(command,6))
            if kind == "rect" { cg.setFillColor(c.cgColor); cg.fill(rect) }
            else { cg.setStrokeColor(c.cgColor); cg.stroke(rect) }
        } else if kind == "text" {
            let text = command[5] as! String
            let fontSpec = command[6] as! String
            let size: CGFloat = fontSpec.contains("12px") ? 12 : (fontSpec.contains("15px") ? 15 : 8)
            let font = NSFont.monospacedSystemFont(ofSize: size, weight: .bold)
            let attrs: [NSAttributedString.Key: Any] = [.font:font,
              .foregroundColor:color(command[1] as! String,Double(num(command,2)))]
            let string = NSAttributedString(string:text, attributes:attrs)
            var x = num(command,3)
            if command[7] as! String == "center" { x -= string.size().width / 2 }
            cg.saveGState(); cg.translateBy(x:x,y:num(command,4)); cg.scaleBy(x:1,y:-1)
            string.draw(at:NSPoint(x:0,y:0)); cg.restoreGState()
        }
    }
    NSGraphicsContext.restoreGraphicsState()
    let png = bitmap.representation(using:.png,properties:[:])!
    try png.write(to:URL(fileURLWithPath:"/tmp/scene-\(mode).png"))
    print("\(mode): \(width)x\(height)")
}
