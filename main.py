import os
import uvicorn
import re
import json
import tempfile
import shutil
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from google import genai
import arxiv
import fitz  # PyMuPDF

load_dotenv()

app = FastAPI(title="ArXiv for Dummies")

# ---------------------------------------------------------------------------
# Gemini client
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    print("[WARNING] GEMINI_API_KEY not set. Create a .env file with your key.")

def get_gemini_client():
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY chưa được cấu hình. Hãy tạo file .env với API key của bạn.")
    return genai.Client(api_key=GEMINI_API_KEY)

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """Ban la mot giao vien gioi, chuyen giai thich cac bai bao khoa hoc phuc tap cho nguoi moi bat dau.
Nhiem vu: Phan tich bai bao khoa hoc duoc cung cap va tao ra mot bai giang de hieu bang TIENG VIET.

Ban PHAI tra ve ket qua duoi dang JSON hop le (khong co markdown code block wrapper) voi dung cau truc sau:

{
  "paper_title": "Ten bai bao goc (tieng Anh)",
  "paper_title_vi": "Ten bai bao dich sang tieng Viet",
  "authors": "Danh sach tac gia",
  "tldr": "Tom tat ngan gon 2-3 cau, viet sao cho nguoi khong chuyen cung hieu duoc. Tranh thuat ngu ky thuat.",
  "eli5": "Giai thich bai bao nhu dang noi voi tre 5 tuoi. Dung vi du doi thuong, phep so sanh de hieu. Viet it nhat 150 tu.",
  "key_concepts": [
    {
      "term": "Thuat ngu ky thuat (tieng Anh)",
      "term_vi": "Dich sang tieng Viet",
      "explanation": "Giai thich don gian, dung vi du neu can. It nhat 2 cau."
    }
  ],
  "sections": [
    {
      "title": "Ten phan (vi du: Gioi thieu, Phuong phap, Thi nghiem, Ket luan)",
      "summary": "Tom tat noi dung phan nay bang ngon ngu don gian. It nhat 5 cau. Giai thich chi tiet muc tieu, phuong phap, va ket qua cua phan nay.",
      "details": "Giai thich THAT CHI TIET noi dung phan nay. Viet it nhat 200 tu. Trinh bay tung y chinh, tung buoc lap luan cua tac gia. Neu co so lieu, bang bieu, hoac ket qua thi nghiem thi mo ta lai. Dung ngon ngu don gian, tu nhien.",
      "concepts": [
        {
          "term": "Thuat ngu xuat hien trong phan nay",
          "explanation": "Giai thich thuat ngu nay trong boi canh cua phan"
        }
      ],
      "formulas": [
        {
          "latex": "Cong thuc LaTeX, vi du: R_p = \\\\sum_{i=1}^{n} w_i \\\\cdot r_i",
          "name": "Ten cong thuc (tieng Viet)",
          "variables": "Giai thich tung bien so: R_p la gi, w_i la gi, r_i la gi...",
          "explanation": "Cong thuc nay dung de lam gi? Tai sao quan trong? Cho vi du cu the voi so lieu minh hoa."
        }
      ],
      "algorithms": [
        {
          "name": "Ten thuat toan / quy trinh",
          "steps": ["Buoc 1: Mo ta...", "Buoc 2: Mo ta...", "Buoc 3: Mo ta..."],
          "explanation": "Thuat toan nay lam gi? Vi du: Giong nhu khi ban di cho va can chon mon nao re nhat..."
        }
      ]
    }
  ],
  "novelty": "Bai bao nay dong gop gi moi? Tai sao quan trong? So sanh voi cac nghien cuu truoc. Viet it nhat 100 tu.",
  "quiz": [
    {
      "question": "Cau hoi trac nghiem kiem tra hieu bai",
      "options": ["A. Dap an 1", "B. Dap an 2", "C. Dap an 3", "D. Dap an 4"],
      "correct": 0,
      "explanation": "Giai thich tai sao dap an dung la dung"
    }
  ]
}

Quy tac:
- key_concepts: liet ke 5-8 khai niem quan trong nhat
- sections: CHIA THAT CHI TIET theo cac phan chinh cua bai bao (thuong 5-10 phan). Moi phan phai co summary, details day du.
  + Neu phan khong co cong thuc, de formulas la mang rong []
  + Neu phan khong co thuat toan, de algorithms la mang rong []
  + concepts trong moi section la cac thuat ngu RIENG cua phan do (khac voi key_concepts tong quat)
  + formulas: PHAI dung LaTeX chuan (dung \\\\ cho backslash trong JSON string). Vi du: "E = mc^2", "\\\\frac{a}{b}", "\\\\sum_{i=1}^{n} x_i"
  + Moi cong thuc PHAI co giai thich tung bien so va vi du cu the
- quiz: tao dung 5 cau hoi trac nghiem
- Viet ro rang, de hieu, tranh thuat ngu phuc tap khi khong can thiet
- Khi dung thuat ngu ky thuat, luon giai thich kem
- correct trong quiz la index (0-3) cua dap an dung trong mang options
- KHONG wrap JSON trong markdown code blocks
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def extract_arxiv_id(url: str) -> str:
    """Extract arXiv paper ID from various URL formats."""
    patterns = [
        r"arxiv\.org/abs/(\d+\.\d+(?:v\d+)?)",
        r"arxiv\.org/pdf/(\d+\.\d+(?:v\d+)?)",
        r"(\d{4}\.\d{4,5}(?:v\d+)?)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise HTTPException(status_code=400, detail=f"Không thể trích xuất ArXiv ID từ URL: {url}")


def extract_text_from_pdf(pdf_path: str, max_pages: int = 50) -> str:
    """Extract text content from a PDF file using PyMuPDF."""
    doc = fitz.open(pdf_path)
    text_parts = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        text_parts.append(page.get_text())
    doc.close()
    full_text = "\n".join(text_parts)
    # Truncate to ~80k chars to stay within token limits
    if len(full_text) > 80000:
        full_text = full_text[:80000] + "\n\n[... nội dung bị cắt do quá dài ...]"
    return full_text


def clean_json_response(text: str) -> dict:
    """Parse JSON from Gemini response, handling markdown code blocks."""
    # Remove markdown code block wrappers if present
    text = text.strip()
    if text.startswith("```"):
        # Remove first line (```json or ```)
        text = re.sub(r"^```\w*\n?", "", text)
        # Remove last ```
        text = re.sub(r"\n?```$", "", text)
        text = text.strip()
    return json.loads(text)


async def analyze_paper_text(paper_text: str, metadata: dict = None) -> dict:
    """Send paper text to Gemini and get structured analysis."""
    client = get_gemini_client()

    user_content = ""
    if metadata:
        user_content += f"Metadata bài báo:\n- Tiêu đề: {metadata.get('title', 'N/A')}\n- Tác giả: {metadata.get('authors', 'N/A')}\n- Ngày: {metadata.get('published', 'N/A')}\n\n"
    user_content += f"Nội dung bài báo:\n\n{paper_text}"

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            {"role": "user", "parts": [{"text": SYSTEM_PROMPT + "\n\n" + user_content}]}
        ],
    )

    try:
        result = clean_json_response(response.text)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Gemini trả về dữ liệu không hợp lệ. Vui lòng thử lại."
        )

    return result


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.post("/api/analyze-url")
async def analyze_url(payload: dict):
    """Analyze an ArXiv paper from its URL."""
    url = payload.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL không được để trống")

    arxiv_id = extract_arxiv_id(url)

    # Fetch paper metadata from ArXiv
    try:
        client = arxiv.Client(num_retries=5, delay_seconds=5)
        search = arxiv.Search(id_list=[arxiv_id])
        results = list(client.results(search))
    except arxiv.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"ArXiv API bi qua tai (rate limit). Vui long thu lai sau vai giay. Chi tiet: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Khong the ket noi ArXiv API: {e}")

    if not results:
        raise HTTPException(status_code=404, detail=f"Khong tim thay bai bao voi ID: {arxiv_id}")

    paper = results[0]
    metadata = {
        "title": paper.title,
        "authors": ", ".join([a.name for a in paper.authors]),
        "published": str(paper.published.date()) if paper.published else "N/A",
        "abstract": paper.summary,
    }

    # Download PDF to temp directory
    tmp_dir = tempfile.mkdtemp()
    try:
        pdf_filename = f"{arxiv_id.replace('/', '_')}.pdf"
        try:
            paper.download_pdf(dirpath=tmp_dir, filename=pdf_filename)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Khong the tai PDF tu ArXiv: {e}")
        pdf_path = os.path.join(tmp_dir, pdf_filename)

        # Extract text
        paper_text = extract_text_from_pdf(pdf_path)

        # Analyze with Gemini
        result = await analyze_paper_text(paper_text, metadata)
        result["arxiv_id"] = arxiv_id
        result["pdf_url"] = paper.pdf_url

        return result
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.post("/api/analyze-pdf")
async def analyze_pdf(file: UploadFile = File(...)):
    """Analyze an uploaded PDF file."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file PDF")

    # Save uploaded file to temp directory
    tmp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(tmp_dir, file.filename)
        with open(pdf_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # Extract text
        paper_text = extract_text_from_pdf(pdf_path)

        # Analyze with Gemini
        result = await analyze_paper_text(paper_text)

        return result
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Serve frontend
# ---------------------------------------------------------------------------
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/")
async def root():
    return FileResponse(str(static_dir / "index.html"))


if __name__ == "__main__":
    # Render assigns a port via the PORT environment variable
    port = int(os.environ.get("PORT", 8000))
    # Must bind to 0.0.0.0 for external access on Render/Docker
    uvicorn.run(app, host="0.0.0.0", port=port)
