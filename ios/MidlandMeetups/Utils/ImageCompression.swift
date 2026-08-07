import UIKit

/// Port of `resizeImageToBase64` in `src/lib/utils.ts`.
///
/// Squad photos are stored inline on the Firestore document, so they have to stay
/// small: the same 320px / quality 0.72 budget the web uses, and the same hard
/// ceiling that keeps a document comfortably under Firestore's 1MB limit.
enum ImageCompression {
    static let maxBase64Length = 250_000

    struct Result {
        let base64: String
        let mimeType: String
    }

    static func compress(
        _ image: UIImage,
        maxDimension: CGFloat = 320,
        quality: CGFloat = 0.72
    ) throws -> Result {
        let size = image.size
        guard size.width > 0, size.height > 0 else {
            throw FirebaseError(message: "Could not read that image.")
        }

        var target = size
        if size.width > maxDimension || size.height > maxDimension {
            if size.width > size.height {
                target = CGSize(
                    width: maxDimension,
                    height: (size.height * (maxDimension / size.width)).rounded()
                )
            } else {
                target = CGSize(
                    width: (size.width * (maxDimension / size.height)).rounded(),
                    height: maxDimension
                )
            }
        }

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1          // target is already in pixels
        format.opaque = true
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }

        guard let data = resized.jpegData(compressionQuality: quality) else {
            throw FirebaseError(message: "Could not compress image.")
        }

        let base64 = data.base64EncodedString()
        guard base64.count <= maxBase64Length else {
            throw FirebaseError(
                message: "That photo is still too large after compression. Try a smaller image."
            )
        }
        return Result(base64: base64, mimeType: "image/jpeg")
    }
}
