import SwiftUI
import UIKit

/// Port of `photoCache.ts`.
///
/// Squad photos live inline on the Firestore document as compressed base64, so
/// decoding them on every cell reuse would be wasteful. Keyed by a cheap
/// fingerprint (id + length + head/tail) so a changed photo invalidates itself.
enum PhotoCache {
    private static let cache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 120
        return cache
    }()

    static func fingerprint(id: String, base64: String, url: String) -> String {
        if !base64.isEmpty {
            let head = base64.prefix(24)
            let tail = base64.suffix(16)
            return "\(id):\(base64.count):\(head):\(tail)"
        }
        if !url.isEmpty { return "\(id):url:\(url.prefix(64))" }
        return "\(id):none"
    }

    static func image(for member: SquadMember) -> UIImage? {
        guard !member.photoBase64.isEmpty else { return nil }
        let key = fingerprint(id: member.id, base64: member.photoBase64, url: member.photoUrl) as NSString

        if let hit = cache.object(forKey: key) { return hit }

        // Tolerate documents that stored a full data: URL rather than raw base64.
        let raw = member.photoBase64.contains(",")
            ? String(member.photoBase64.split(separator: ",").last ?? "")
            : member.photoBase64

        guard
            let data = Data(base64Encoded: raw, options: .ignoreUnknownCharacters),
            let image = UIImage(data: data)
        else { return nil }

        cache.setObject(image, forKey: key)
        return image
    }
}

/// `SquadPhoto.tsx` — the photo when there is one, otherwise a colored initial.
struct SquadAvatar: View {
    let member: SquadMember
    var size: CGFloat = 112

    var body: some View {
        Group {
            if let image = PhotoCache.image(for: member) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else if let url = URL(string: member.photoUrl), !member.photoUrl.isEmpty {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFill()
                    default: initialsCircle
                    }
                }
            } else {
                initialsCircle
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var initialsCircle: some View {
        ZStack {
            Theme.blue
            Text(initial)
                .font(.system(size: size * 0.4, weight: .bold))
                .foregroundStyle(.white)
        }
    }

    private var initial: String {
        let trimmed = member.name.trimmingCharacters(in: .whitespaces)
        guard let first = trimmed.first else { return "?" }
        return String(first).uppercased()
    }
}
