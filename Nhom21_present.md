

# SLIDE 1 - TIÊU ĐỀ

## Nền tảng học tiếng Anh tích hợp trí tuệ nhân tạo: PENGWIN

### Học phần: Phát triển ứng dụng Web

- **Nhóm thực hiện:** Pengwin AI Team
- **Sinh viên:**
	- Trần Quốc Sang - 23715111 (Trưởng nhóm)
	- Võ Thành Nhã - 23709251
	- Trần Thị Kim Ngân - 23719511
- **Giảng viên hướng dẫn:** ThS. Trương Vĩnh Linh

---

# SLIDE 2 - GIỚI THIỆU BÀI TOÁN

Người học tiếng Anh thường gặp 3 vấn đề chính:

- **Thiếu động lực:** Khó duy trì thói quen học đều mỗi ngày.
- **Thiếu phản hồi tức thì:** Không có môi trường luyện tập và sửa lỗi liên tục.
- **Lộ trình chưa cá nhân hóa:** Khó theo dõi tiến độ và ôn tập theo mức độ ghi nhớ.

**Pengwin** giải quyết các vấn đề này bằng:

- **Micro-learning:** Bài học và câu hỏi được chia nhỏ, dễ tiếp thu.
- **Interactive Practice:** Làm bài tập và nhận kết quả ngay.
- **AI Chat Tutor:** Hỗ trợ luyện hội thoại, lưu lịch sử chat và gợi ý phản hồi theo ngữ cảnh.
- **Streak + Spaced Repetition:** Tăng động lực học đều và tối ưu ôn tập dài hạn.

---

# SLIDE 3 - MỤC TIÊU HỆ THỐNG

- Xây dựng nền tảng học trực tuyến đa người dùng với phân quyền rõ ràng.
- Hỗ trợ 3 vai trò chính: **Student, Creator, Admin**.
- Cung cấp các chức năng cốt lõi: đăng nhập, luyện tập, ôn tập, chat AI, quản lý nội dung.
- Theo dõi tiến độ học tập qua **Dashboard**, **Progress** và **Streak**.
- Áp dụng **SM-2 / Spaced Repetition** để nhắc lịch ôn tập tự động.
- Tạo trải nghiệm học tập liên tục, trực quan và có tính tương tác cao.

---

# SLIDE 4 - USE CASE / CHỨC NĂNG

### 🐧 Người học (Student)

- Đăng ký, đăng nhập và quản lý hồ sơ cá nhân.
- Xem Dashboard, điểm tiến bộ và số ngày streak.
- Làm bài **Practice** và nhận kết quả ngay sau khi nộp.
- Ôn tập các thẻ đến hạn trong **Review**.
- Chat với **AI Tutor** để luyện viết và phản hồi nội dung.

### 🐧 Người sáng tạo (Creator)

- Tạo và quản lý **Lessons**.
- Tạo, chỉnh sửa và quản lý **Questions**.
- Theo dõi trạng thái duyệt nội dung từ Admin.

### 🐧 Quản trị viên (Admin)

- Quản lý người dùng, phân quyền và khóa/mở tài khoản.
- Duyệt nội dung bài học và câu hỏi từ Creator.
- Xem thống kê hệ thống và danh sách người dùng.

---

# SLIDE 5 - KIẾN TRÚC HỆ THỐNG

### Frontend

- **React 18** + **React Router v6**.
- Các trang chính: Login, Register, Dashboard, Skills, Practice, Review, Progress, Chat, Profile.
- Các trang quản trị: CreatorLessons, CreatorQuestions, AdminDashboard, AdminUsers, AdminContent.

### Backend

- **FastAPI** chạy với **Python 3.12+**.
- Các module chính: Auth, Users, Lessons, Questions, Review, Chat, Admin.
- Logic nghiệp vụ: JWT, SM-2, streak tracking, phân quyền theo vai trò.

### Database

- **SQLite + SQLAlchemy**.
- Lưu trữ người dùng, skill profile, bài học, câu hỏi, review card, streak và lịch sử chat.

### Bảo mật

- **JWT** để duy trì phiên đăng nhập.
- Mật khẩu được mã hóa bằng **Passlib/Bcrypt**.
- CORS được cấu hình để frontend gọi API từ backend.

---

# SLIDE 6 - QUY TRÌNH DEMO

1. **Đăng nhập Student:** vào Dashboard để xem tiến độ, streak và số bài đến hạn.
2. **Practice:** làm bài trắc nghiệm, nộp đáp án và xem kết quả tức thì.
3. **Review:** ôn tập các thẻ đến hạn theo cơ chế SM-2.
4. **Chat:** trao đổi với AI Tutor và xem lịch sử hội thoại.
5. **Admin:** đăng nhập quyền Admin để duyệt nội dung và xem thống kê hệ thống.

---

# SLIDE 7 - ỨNG DỤNG TRÍ TUỆ NHÂN TẠO (AI)

Hệ thống tích hợp AI ở 2 mức:

- **AI Tutor:** hỗ trợ hội thoại và phản hồi theo ngữ cảnh học tập.
- **Hỗ trợ phát triển:** nhóm sử dụng AI để tăng tốc xây dựng giao diện, tạo dữ liệu mẫu, hỗ trợ debug và viết test.

Trong dự án hiện tại, phần AI được tổ chức theo hướng thực dụng: ưu tiên trải nghiệm luyện tập, lưu lịch sử chat và chuẩn bị sẵn hệ thống để mở rộng thêm mô hình ngôn ngữ lớn ở các phiên bản sau.

---

# SLIDE 8 - KẾT QUẢ & ĐÁNH GIÁ

### Đã hoàn thành (MVP)

- Hoàn thiện backend với đầy đủ các router nghiệp vụ chính.
- Frontend React đồng bộ theo thương hiệu Pengwin và hỗ trợ đa thiết bị.
- Tích hợp thành công dashboard, practice, review, chat và trang quản trị.
- Có cơ chế streak và spaced repetition để hỗ trợ việc học liên tục.

### Hướng phát triển

- Nâng cấp AI Tutor để phản hồi thông minh hơn theo ngữ cảnh.
- Bổ sung phân tích dữ liệu học tập chi tiết hơn.
- Mở rộng thêm nội dung luyện tập theo nhiều chủ đề và cấp độ.

---

