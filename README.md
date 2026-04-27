# ArXiv for Dummies 🧠📄

Ứng dụng web thông minh giúp đơn giản hóa các bài báo khoa học phức tạp từ ArXiv thành bài giảng dễ hiểu bằng tiếng Việt, tích hợp AI (Google Gemini).

## ✨ Tính năng nổi bật

- **Phân tích thông minh**: Chuyển đổi nội dung học thuật khó hiểu thành ngôn ngữ bình dân.
- **Breakdown chi tiết**: Chia bài báo thành các phần nhỏ (Giới thiệu, Phương pháp, Kết quả...) với giải thích sâu sắc.
- **Hỗ trợ Toán học & Thuật toán**: Tự động trích xuất và hiển thị công thức LaTeX (qua KaTeX) và quy trình từng bước.
- **Học tập tương tác**:
  - **TL;DR**: Tóm tắt cực ngắn.
  - **ELI5**: Giải thích như cho trẻ 5 tuổi.
  - **Concept Chips**: Giải thích thuật ngữ chuyên ngành khi hover.
  - **Quiz**: 5 câu hỏi trắc nghiệm kiểm tra độ hiểu bài.
- **Giao diện hiện đại**: Dark mode, phong cách Glassmorphism, hiệu ứng mượt mà.

## 🛠️ Công nghệ sử dụng

- **Backend**: FastAPI (Python)
- **AI Model**: Google Gemini 1.5 Flash (với structured JSON output)
- **PDF Processing**: PyMuPDF (fitz)
- **Frontend**: Vanilla JS, CSS3 (Glassmorphism), HTML5
- **Math Rendering**: KaTeX

## 🚀 Cài đặt & Chạy ứng dụng

### 1. Yêu cầu hệ thống
- Python 3.9+
- API Key từ [Google AI Studio](https://aistudio.google.com/)

### 2. Cài đặt thư viện
```bash
pip install -r requirements.txt
```

### 3. Cấu hình biến môi trường
Tạo file `.env` trong thư mục gốc và thêm key của bạn:
```env
GEMINI_API_KEY=your_api_key_here
```

### 4. Chạy Server
```bash
python main.py
```
Hoặc dùng uvicorn trực tiếp:
```bash
uvicorn main:app --reload
```

Truy cập: `http://localhost:8000`

## 📸 Ảnh chụp màn hình
*(Bạn có thể bổ sung ảnh chụp màn hình vào đây)*

## 📝 License
MIT