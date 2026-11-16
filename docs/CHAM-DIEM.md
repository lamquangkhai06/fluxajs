# Bảng tiêu chí chấm điểm một framework UI

Tổng 100 điểm, chia 10 nhóm. Mỗi tiêu chí chấm 0–5 (xem thang ở cuối), nhân với trọng số của nhóm.
Nguyên tắc: **chỉ chấm điều đã đo hoặc đã kiểm chứng**. Chưa kiểm chứng thì ghi "?" và không tính điểm.

## 1. Thiết kế API và độ dễ học (15 điểm)
| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| 1.1 | Số khái niệm phải học để làm app đầu tiên | Đếm hàm/khái niệm trong hướng dẫn nhập môn |
| 1.2 | Thời gian từ zero đến app chạy được | Nhờ 3 người mới bấm giờ |
| 1.3 | Mã ngắn gọn cho tác vụ phổ biến (đếm, form, danh sách, gọi API) | Đếm dòng so với React/Vue/Svelte |
| 1.4 | Thông báo lỗi rõ ràng, chỉ cách sửa | Cố ý viết sai 10 kiểu rồi đọc lỗi |
| 1.5 | Ít "bẫy" (cú pháp dễ nhầm, quy tắc ngầm) | Liệt kê lỗi người mới hay gặp |
| 1.6 | Nhất quán: cùng một việc chỉ có một cách chính | Rà soát API |

## 2. Hiệu năng (12 điểm)
| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| 2.1 | Tốc độ tạo/cập nhật/xóa nhiều dòng | js-framework-benchmark |
| 2.2 | Cập nhật nhỏ (đổi 1 giá trị) | Đo thời gian và số node DOM bị chạm |
| 2.3 | Bộ nhớ khi có 10.000 dòng | Chrome DevTools Memory |
| 2.4 | Thời gian khởi động (TTI) trên máy yếu | Lighthouse, CPU giảm tốc 4× |
| 2.5 | Rò rỉ bộ nhớ (mount/unmount lặp 1.000 lần) | Heap snapshot |

## 3. Kích thước (6 điểm)
| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| 3.1 | Dung lượng lõi (nén + gzip) | Đo bản build |
| 3.2 | Dung lượng app mẫu hoàn chỉnh | Build app todo/dashboard |
| 3.3 | Tree-shaking (dùng ít trả ít) | So kích thước khi chỉ import 1 hàm |

## 4. Bảo mật (14 điểm)
| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| 4.1 | XSS qua nội dung/thuộc tính/URL/style | Bộ payload chạy trên trình duyệt thật |
| 4.2 | Tương thích CSP và Trusted Types | Chạy test dưới CSP nghiêm ngặt |
| 4.3 | Prototype pollution, khóa nguy hiểm | Payload `__proto__`, `constructor` |
| 4.4 | Router: open redirect, URL độc | Payload chuyển hướng |
| 4.5 | Mặc định an toàn (cách dễ nhất cũng là cách an toàn) | Người mới có tự gây lỗ hổng được không? |
| 4.6 | Thành phần phụ thuộc bên thứ ba | Đếm phụ thuộc, chạy `npm audit` |
| 4.7 | Kiểm toán độc lập, quy trình báo lỗi | Có báo cáo bên ngoài? Có `SECURITY.md`? |

## 5. Tính năng (12 điểm)
| # | Tiêu chí | Ghi chú |
|---|---|---|
| 5.1 | Phản ứng (signals/state), dữ liệu suy ra | Cốt lõi |
| 5.2 | Router, store dùng chung | |
| 5.3 | Form + kiểm tra dữ liệu | |
| 5.4 | Tải dữ liệu (loading/lỗi/hủy yêu cầu) | |
| 5.5 | Bộ UI component, giao diện tối | |
| 5.6 | Đa ngôn ngữ, lưu trạng thái | |
| 5.7 | SSR / hydration / SSG | Thường là điểm yếu của framework mới |
| 5.8 | Animation/transition, portal, lazy load | |

## 6. Khả năng truy cập — a11y (6 điểm)
| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| 6.1 | Component đúng vai trò ARIA, có nhãn | axe-core trên app mẫu |
| 6.2 | Điều hướng bàn phím đầy đủ (Tab, mũi tên, Esc) | Thử chỉ bằng bàn phím |
| 6.3 | Quản lý tiêu điểm (modal, dropdown) | Thử với trình đọc màn hình |
| 6.4 | Độ tương phản, tôn trọng `prefers-reduced-motion` | Lighthouse |

## 7. Trải nghiệm lập trình viên — DX (10 điểm)
| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| 7.1 | Hỗ trợ TypeScript (kiểu chính xác, gợi ý tốt) | `tsc` trên mã mẫu |
| 7.2 | Công cụ build: Vite/Webpack, HMR | Chạy thật |
| 7.3 | Chạy không cần build (CDN/file://) | Mở bằng trình duyệt |
| 7.4 | Devtools (xem state, theo dõi cập nhật) | |
| 7.5 | Tích hợp CSS (Tailwind, CSS modules) | Chạy thật |
| 7.6 | Hỗ trợ AI/vibe coding (tài liệu cho AI, tỉ lệ code sinh ra chạy đúng) | Cho AI viết 20 app, đếm tỉ lệ đúng |

## 8. Chất lượng kỹ thuật và độ tin cậy (10 điểm)
| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| 8.1 | Độ phủ test (đơn vị + trình duyệt thật) | Báo cáo coverage |
| 8.2 | Kiểm thử đột biến (test có bắt được lỗi cố ý không) | Phá mã rồi chạy test |
| 8.3 | Chạy trên Chrome, Firefox, Safari, di động | Kiểm thử đa trình duyệt |
| 8.4 | Xử lý lỗi: không crash toàn app | Ném lỗi trong component |
| 8.5 | CI tự chạy test, phát hành có phiên bản (SemVer) | |
| 8.6 | Tương thích ngược, chính sách thay đổi API | |

## 9. Tài liệu và học liệu (7 điểm)
| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| 9.1 | Hướng dẫn nhập môn, ví dụ chạy được | Làm theo từng bước |
| 9.2 | Tài liệu tham chiếu API đầy đủ | Mọi hàm đều có mô tả + ví dụ |
| 9.3 | Ví dụ ứng dụng thực tế | Số lượng và độ phức tạp |
| 9.4 | Hướng dẫn chuyển từ React/Vue | |
| 9.5 | Tài liệu đúng với mã (test tự chạy ví dụ) | |

## 10. Hệ sinh thái và cộng đồng (8 điểm)
| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| 10.1 | Số người dùng thật, số app đang chạy | Lượt tải npm, dự án công khai |
| 10.2 | Thư viện/plugin bên thứ ba | |
| 10.3 | Người đóng góp, tốc độ trả lời issue/PR | GitHub Insights |
| 10.4 | Độ bền duy trì (nhiều người bảo trì, có lộ trình) | |
| 10.5 | Tuyển dụng, bài viết, khóa học | |

---

## Thang điểm cho mỗi tiêu chí
| Điểm | Ý nghĩa |
|---|---|
| 0 | Không có |
| 1 | Có nhưng sơ sài hoặc sai |
| 2 | Cơ bản, còn nhiều thiếu sót |
| 3 | Dùng được, ngang mức trung bình |
| 4 | Tốt, ngang các framework nổi tiếng |
| 5 | Xuất sắc, dẫn đầu ngành |

**Cách tính:** điểm nhóm = (tổng điểm các tiêu chí ÷ (5 × số tiêu chí)) × trọng số nhóm. Tiêu chí ghi "?" thì bỏ khỏi cả tử và mẫu, nhưng phải ghi rõ trong báo cáo. Tổng các nhóm là điểm cuối (tối đa 100).

**Xếp loại tham khảo:** dưới 40 = thử nghiệm · 40–59 = dùng cho dự án nhỏ · 60–74 = dùng được trong sản xuất có chọn lọc · 75–89 = tốt · 90+ = hàng đầu.

## Quy tắc để chấm trung thực
1. Mỗi điểm phải kèm bằng chứng (số đo, đường dẫn test, ảnh chụp).
2. Không tự chấm mục 10 (hệ sinh thái) cao khi chưa có người dùng ngoài.
3. Với mục 4.7 và 8.3, chỉ được từ 3 điểm trở lên khi có kiểm toán và thử nghiệm bên ngoài thực sự.
4. Nên nhờ ít nhất một người khác chấm độc lập rồi lấy trung bình.
5. So sánh công bằng: chấm cả React, Vue, Svelte, Solid bằng đúng bảng này.
