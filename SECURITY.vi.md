[English](SECURITY.md) | **Tiếng Việt**

# Bảo mật

Fluxa được thiết kế **an toàn theo mặc định**: cách viết đơn giản nhất cũng là cách an toàn nhất. Tuy nhiên không framework nào bảo vệ được toàn bộ ứng dụng; tài liệu này nói rõ phần Fluxa làm và phần bạn phải làm.

## Fluxa làm gì

1. **Chống XSS qua nội dung.** Mọi chuỗi bạn truyền làm nội dung đều đi qua `createTextNode`. Không có API nào dùng `innerHTML`. `unsafeHTML(html, sanitize)` là lối thoát duy nhất và **bắt buộc** truyền hàm làm sạch (ví dụ `DOMPurify.sanitize`).
2. **Lọc URL.** Các thuộc tính `href`, `src`, `action`, `formaction`, `poster`, `cite`, `background`, `xlink:href`, `longdesc`, `data`, `manifest` chỉ nhận `http:`, `https:`, `mailto:`, `tel:` và URL tương đối. Dùng bộ phân tích URL của trình duyệt nên không bị đánh lừa bởi `JaVaScRiPt:`, tab/xuống dòng chen giữa, khoảng trắng đầu chuỗi.
3. **Sự kiện chỉ nhận hàm.** `onclick: "alert(1)"` bị loại bỏ và báo lỗi.
4. **Chặn thẻ và thuộc tính nguy hiểm.** Thẻ `script`, `style`, `object`, `embed`, `applet`, `base`, `meta`, `link`, `frame`, `frameset`, `foreignObject`; thuộc tính `innerHTML`, `outerHTML`, `srcdoc`, `srcset`, `ping`, mọi khóa bắt đầu bằng `__`; `attributeName` trỏ tới `href`/`on*` trong SVG. `iframe` tự có `sandbox=""`.
5. **Chống tabnabbing.** `target="_blank"` tự thêm `rel="noopener noreferrer"`.
6. **Router an toàn.** Chỉ nhận đường dẫn nội bộ bắt đầu bằng một dấu `/`; kiểm tra cùng origin (chặn `//evil.com`, `/\evil.com`, `javascript:`); giới hạn độ dài đường dẫn (2048), số đoạn (50), số khóa query (100); query/params là object không prototype.
7. **Độ bền.** Chặn vòng lặp cập nhật vô hạn; lỗi trong một effect không làm hỏng effect khác; `computed` phụ thuộc vòng bị báo lỗi thay vì tràn stack; effect và `list` tự dọn dẹp để không rò rỉ bộ nhớ.
8. **Tương thích CSP nghiêm ngặt.** Không dùng `eval`, `new Function`, script/style inline. Xem `index.html` để biết chính sách mẫu.
9. **Component UI.** `variant`, `size`, `tone`, `type` chỉ nhận giá trị trong danh sách cho phép (không chèn được tên class tùy ý); `Input` chỉ nhận các `type` an toàn (không có `file`, `hidden`, `image`...); nội dung toast, alert và thông báo lỗi luôn là chữ thuần; `Button` mặc định `type="button"` để không vô tình gửi form; số toast hiển thị cùng lúc có giới hạn; `Modal` giữ tiêu điểm trong hộp và trả lại khi đóng.
10. **Store.** Từ chối khóa `__proto__`, `constructor`, `prototype` và khóa kiểu symbol; dữ liệu nằm trong object không có prototype; đọc khóa lạ không tạo thêm bộ nhớ.
11. **JSX và Vite plugin.** `key` và `children` không đi vào thuộc tính DOM; tùy chọn `importFrom` của plugin được kiểm tra ký tự nên không thể chèn mã vào dòng import tự sinh. Phần mã HMR do plugin thêm chỉ chạy ở dev server (không có trong bản build), là đoạn cố định, và đường dẫn trong đó được lấy từ chính dòng `import { mount }` đã có trong file rồi qua `JSON.stringify`.
12. **Lối tắt an toàn.** `class` dạng object/mảng luôn qua cùng đường gán `className` (không có đường chèn HTML); ràng buộc tự động chỉ gắn cho `input`/`textarea`/`select`; `model()` dùng cùng bộ lọc khóa như store (từ chối `__proto__`, `constructor`, `prototype`). `resource()` hủy yêu cầu cũ bằng `AbortController` và bỏ qua mọi phản hồi cũ, nên dữ liệu lỗi thời không bao giờ hiện lên; `choose()` chỉ tra khóa của chính object bạn đưa vào (`Object.hasOwn`), nên giá trị như `"constructor"` hay `"__proto__"` không bao giờ lấy nhầm khóa kế thừa; kết quả của `resource` vẫn là dữ liệu thô, nếu bạn hiển thị thì vẫn đi qua `createTextNode` như mọi nội dung khác.
13. **Trusted Types.** `unsafeHTML` là chỗ duy nhất Fluxa gán chuỗi vào `innerHTML`; khi trang bật `require-trusted-types-for 'script'`, kết quả của hàm làm sạch được bọc bằng chính sách `fluxa` (CSP cần `trusted-types fluxa`). Có bộ kiểm thử công khai `security.cjs` (`npm run test:security`) chạy trên Chromium thật dưới CSP + Trusted Types.
14. **Module mở rộng (`fluxa-extras.js`).** `persist` đọc JSON qua bộ lọc bỏ `__proto__`/`constructor`/`prototype`, giới hạn 1.000.000 ký tự, và bỏ qua dữ liệu hỏng thay vì báo lỗi; hãy dùng `revive` để kiểm tra hình dạng dữ liệu. `form` từ chối tên trường dành riêng; giới hạn độ dài khi chạy `rules.pattern` chỉ giảm rủi ro treo trang, **không cứu được một regex viết tệ**. `createI18n` chỉ tra khóa của chính object bản dịch và chèn `{tham_số}` như chữ thuần. `createTheme` chỉ nhận `light`/`dark`/`auto`. `Avatar` lọc URL ảnh; `Table` chỉ đọc thuộc tính của chính hàng và hiển thị chữ thuần; `Tooltip`/`Dropdown` chỉ gắn trình lắng nghe khi đang mở và tự gỡ. `debounced` giới hạn thời gian chờ tối đa 60 giây, `history` giới hạn 1000 bước.
15. **Nhập liệu và biểu đồ (0.10).** `Combobox`, `DatePicker`, `FileInput` và mọi biểu đồ hiển thị nhãn, chữ của lựa chọn và tên file dưới dạng chữ thuần (không dùng `innerHTML`). Danh sách `accept` được lọc theo mẫu nghiêm ngặt. Việc `FileInput` kiểm tra loại, dung lượng, số lượng chạy ở trình duyệt và **chỉ để cải thiện trải nghiệm, không phải biện pháp bảo mật: server phải kiểm tra lại mọi file tải lên.** Biểu đồ ép số không hợp lệ về 0 và giới hạn 1000 điểm, 12 chuỗi để dữ liệu quá lớn không làm treo trang. `DatePicker` tính ngày theo UTC và chỉ nhận chuỗi `YYYY-MM-DD` đúng định dạng.

## Bạn vẫn phải làm

- **Server là nơi bảo mật thật.** Xác thực, phân quyền, kiểm tra dữ liệu ở server. `beforeEach` của router chỉ để điều hướng đẹp, kẻ tấn công bỏ qua được.
- **Tiêu đề HTTP.** `Content-Security-Policy` (bản `<meta>` không hỗ trợ `frame-ancestors`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS, và `frame-ancestors`/`X-Frame-Options` để chống clickjacking. Nếu bật Trusted Types: `require-trusted-types-for 'script'` (Fluxa chỉ chạm tới sink `innerHTML` trong `unsafeHTML`).
- **Làm sạch HTML** nếu bạn dùng `unsafeHTML`: dùng thư viện đã được kiểm chứng như DOMPurify, đừng tự viết.
- **Không đặt dữ liệu nhạy cảm vào URL**, `localStorage` hoặc mã phía client.
- **Kiểm tra phụ thuộc của bạn** (Fluxa không có phụ thuộc, nhưng ứng dụng của bạn có thể có).
- **CSS.** Truyền `style` dạng object thay vì chuỗi khi giá trị đến từ người dùng; không ghép chuỗi người dùng vào URL trong CSS.

## Giới hạn đã biết

- Fluxa chưa được kiểm toán bảo mật độc lập và mới được thử trên Chromium (kiểm thử đầu-cuối `e2e.cjs`); phần lớn test chạy trên DOM giả lập trong Node. Chưa thử trên Firefox và Safari.
- URL tuyệt đối `http(s)` (kể cả `//host/x`) tới host bất kỳ được phép theo thiết kế, nên `<img src>` hay `<a href>` có thể trỏ ra ngoài. Hãy giới hạn host bằng CSP (`img-src`, `connect-src`, `frame-src`...).
- Lọc thuộc tính dựa trên danh sách; thuộc tính mới của chuẩn HTML trong tương lai có thể cần bổ sung. Hãy cập nhật phiên bản đều đặn.
- Store chỉ phản ứng ở mức nông và không giới hạn số khóa bạn tự ghi vào. Đừng dùng dữ liệu do người dùng kiểm soát làm tên khóa.
- Nếu mở nhiều `Modal` cùng lúc, phím Esc sẽ đóng tất cả (chưa có ngăn xếp hộp thoại).

## Báo lỗi bảo mật

Nếu bạn tìm thấy lỗ hổng, **đừng mở issue công khai**. Hãy liên hệ riêng người duy trì dự án (thêm địa chỉ liên hệ hoặc bật GitHub Security Advisories khi công bố mã nguồn). Hãy mô tả cách tái hiện; lỗi sẽ được sửa trước khi công bố.
