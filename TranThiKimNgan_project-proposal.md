
# PROJECT PROPOSAL

## THÔNG TIN

### Nhóm

* **Thành viên 1:** Trần Quốc Sang – 23715111 (Trưởng nhóm)
* **Thành viên 2:** Võ Thanh Nhã – 23709251
* **Thành viên 3:** Trần Thị Kim Ngân – 2371951
### Git

* **Git repository:** [https://github.com/tranthikimngan2005/ai-english-learning-platform](https://github.com/tranthikimngan2005/ai-english-learning-platform)

---

## MÔ TẢ DỰ ÁN

### Ý tưởng

Dự án **AI Gamified English Learning Platform** giải quyết vấn đề mất động lực khi tự học tiếng Anh bằng cách kết hợp **Gamification** (hệ thống Streak, nhiệm vụ) và **AI Conversation**. Điểm khác biệt nằm ở khả năng phản hồi tức thì từ AI giúp người học nhận ra lỗi sai ngữ pháp ngay trong lúc hội thoại, tạo trải nghiệm học tập cá nhân hóa và thú vị hơn các ứng dụng truyền thống.
# Mục tiêu của dự án

* xây dựng nền tảng học tiếng Anh trực tuyến
* cung cấp các bài học micro-learning
* hỗ trợ luyện hội thoại bằng AI
* phân tích tiến độ học tập của người dùng
* cá nhân hóa nội dung học tập

### Chi tiết
1. **Quản lý người dùng:** Đăng ký, đăng nhập và theo dõi tiến độ cá nhân.
2. **Micro-learning:** Bài học ngắn (1–5 phút) về Từ vựng, Ngữ pháp, Nghe, Đọc.
3. **Quiz System:** Bài tập đa dạng (trắc nghiệm, điền từ, dịch câu) có chấm điểm tự động.
4. **Smart Streak:** Cơ chế thúc đẩy hoàn thành mục tiêu hàng ngày để duy trì chuỗi Streak học tập.
5. **AI Conversation Tutor:** Luyện giao tiếp với AI, hỗ trợ sửa lỗi ngữ pháp và từ vựng theo thời gian thực.
6. **Analytics & Recommendation:** Dashboard phân tích điểm mạnh/yếu và gợi ý nội dung học phù hợp.

---

## PHÂN TÍCH & THIẾT KẾ

### 1. Actors & Use Cases

* **Student:** Actor chính thực hiện các Use Case: Đăng ký/Đăng nhập, Học bài, Làm Quiz, Luyện hội thoại AI, Xem Dashboard.
* **Admin:** Actor quản lý: Quản lý khóa học (CRUD), Quản lý bộ câu hỏi Quiz, Quản lý tài khoản người dùng.
* **Viewer:** Actor chưa đăng ký: Xem trang giới thiệu và danh sách khóa học công khai.

### 2. Thiết kế Cơ sở dữ liệu (ERD)

Hệ thống sử dụng **SQLite** với cấu trúc các bảng chính:

* `Users`: Lưu thông tin cá nhân, mật khẩu (hash), và số ngày Streak hiện tại.
* `Courses` & `Lessons`: Lưu thông tin phân cấp về khóa học và các bài học nhỏ.
* `Questions`: Lưu bộ câu hỏi, đáp án và loại câu hỏi (trắc nghiệm, điền từ).
* `Learning_Logs`: Lưu lịch sử học tập, số điểm đạt được của từng Student.

### 3. Kiến trúc Hệ thống

* **Frontend (ReactJS):** Xử lý giao diện động, gọi API và hiển thị biểu đồ Dashboard.
* **Backend (FastAPI):** Xử lý logic nghiệp vụ, quản lý Authentication qua JWT và kết nối với AI Model.
* **Database (SQLite):** Lưu trữ dữ liệu quan hệ nhẹ nhàng, phù hợp cho môi trường lab và phát triển nhanh.

---

## KẾ HOẠCH

### 1. MVP (Deadline: 12.04.2026)

* **Chức năng:** Hoàn thiện luồng Đăng ký/Đăng nhập; Quản lý bài học & Quiz (phía Admin); Làm bài & lưu điểm (phía Student).
* **Kế hoạch kiểm thử:**
* **Unit Test:** Kiểm tra logic chấm điểm bài Quiz và xác thực JWT.
* **Integration Test:** Kiểm tra sự đồng bộ dữ liệu giữa Frontend ReactJS và Backend FastAPI.


* **Chức năng dự trù:** Hệ thống Streak và AI Chatbot sơ khai.

### 2. Beta Version (Deadline: 10.05.2026)

* **Nội dung:** Tích hợp đầy đủ AI Conversation Tutor; Dashboard phân tích tiến độ; Hệ thống Recommendation gợi ý bài học dựa trên lịch sử sai sót.
* **Kết quả:** Hoàn thiện giao diện UI/UX, báo cáo kiểm thử tổng thể và tối ưu hiệu suất API.

---

## CÂU HỎI CHO GIẢNG VIÊN

* Nhóm có thể sử dụng các thư viện AI mã nguồn mở (như HuggingFace) thay vì API trả phí để tích hợp vào phần Conversation không?
* Về phần Recommendation System, thầy có yêu cầu nhóm phải sử dụng thuật toán Machine Learning chuyên sâu hay chỉ cần dùng logic dựa trên Rule-based?

---

## HƯỚNG DẪN CÀI ĐẶT (INSTALLATION)

1. **Clone:** `git clone https://github.com/tranthikimngan2005/ai-english-learning-platform`.
2. **Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate (hoặc venv\Scripts\activate trên Windows)
pip install -r requirements.txt
uvicorn main:app --reload

```


3. **Frontend:**
```bash
cd frontend
npm install
npm start

