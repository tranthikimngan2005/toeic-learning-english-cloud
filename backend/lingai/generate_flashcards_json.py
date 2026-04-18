from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data" / "raw" / "flashcards.json"

WORD_BANK = {
    "business": [
        ("meeting", "/ˈmiːtɪŋ/", "cuộc họp", "core"),
        ("deadline", "/ˈdedlaɪn/", "hạn chót", "core"),
        ("budget", "/ˈbʌdʒɪt/", "ngân sách", "core"),
        ("client", "/ˈklaɪənt/", "khách hàng", "core"),
        ("revenue", "/ˈrevənjuː/", "doanh thu", "advanced"),
        ("invoice", "/ˈɪnvɔɪs/", "hóa đơn", "core"),
        ("contract", "/ˈkɒntrækt/", "hợp đồng", "core"),
        ("negotiate", "/nɪˈɡəʊʃieɪt/", "thương lượng", "advanced"),
        ("stakeholder", "/ˈsteɪkˌhəʊldə/", "bên liên quan", "advanced"),
        ("proposal", "/prəˈpəʊzl/", "đề xuất", "core"),
    ],
    "office": [
        ("memo", "/ˈmeməʊ/", "bản ghi nhớ", "starter"),
        ("desk", "/desk/", "bàn làm việc", "starter"),
        ("printer", "/ˈprɪntə/", "máy in", "starter"),
        ("colleague", "/ˈkɒliːɡ/", "đồng nghiệp", "core"),
        ("schedule", "/ˈʃedjuːl/", "lịch trình", "core"),
        ("archive", "/ˈɑːkaɪv/", "lưu trữ", "core"),
        ("manager", "/ˈmænɪdʒə/", "quản lý", "core"),
        ("confirm", "/kənˈfɜːm/", "xác nhận", "core"),
        ("submit", "/səbˈmɪt/", "nộp, gửi", "core"),
        ("file", "/faɪl/", "hồ sơ", "starter"),
    ],
    "travel": [
        ("ticket", "/ˈtɪkɪt/", "vé", "starter"),
        ("boarding", "/ˈbɔːdɪŋ/", "lên máy bay", "core"),
        ("baggage", "/ˈbæɡɪdʒ/", "hành lý", "starter"),
        ("depart", "/dɪˈpɑːt/", "khởi hành", "core"),
        ("arrival", "/əˈraɪvl/", "sự đến nơi", "core"),
        ("customs", "/ˈkʌstəmz/", "hải quan", "core"),
        ("reservation", "/ˌrezəˈveɪʃn/", "đặt chỗ", "core"),
        ("itinerary", "/aɪˈtɪnərəri/", "lịch trình chuyến đi", "advanced"),
        ("shuttle", "/ˈʃʌtl/", "xe đưa đón", "core"),
        ("passport", "/ˈpɑːspɔːt/", "hộ chiếu", "starter"),
    ],
    "marketing": [
        ("campaign", "/kæmˈpeɪn/", "chiến dịch", "core"),
        ("advertise", "/ˈædvətaɪz/", "quảng cáo", "core"),
        ("brand", "/brænd/", "thương hiệu", "starter"),
        ("promote", "/prəˈməʊt/", "quảng bá", "core"),
        ("survey", "/ˈsɜːveɪ/", "khảo sát", "core"),
        ("audience", "/ˈɔːdiəns/", "khán giả", "core"),
        ("slogan", "/ˈsləʊɡən/", "khẩu hiệu", "starter"),
        ("target", "/ˈtɑːɡɪt/", "mục tiêu", "core"),
        ("strategy", "/ˈstrætədʒi/", "chiến lược", "core"),
        ("launch", "/lɔːntʃ/", "ra mắt", "core"),
    ],
    "logistics": [
        ("warehouse", "/ˈweəhaʊs/", "kho hàng", "core"),
        ("shipment", "/ˈʃɪpmənt/", "lô hàng", "core"),
        ("supplier", "/səˈplaɪə/", "nhà cung cấp", "core"),
        ("inventory", "/ˈɪnvəntri/", "hàng tồn kho", "advanced"),
        ("deliver", "/dɪˈlɪvə/", "giao hàng", "core"),
        ("distribute", "/dɪˈstrɪbjuːt/", "phân phối", "advanced"),
        ("route", "/ruːt/", "tuyến đường", "core"),
        ("package", "/ˈpækɪdʒ/", "bưu kiện", "starter"),
        ("order", "/ˈɔːdə/", "đơn hàng", "starter"),
        ("truck", "/trʌk/", "xe tải", "starter"),
    ],
    "finance": [
        ("account", "/əˈkaʊnt/", "tài khoản", "core"),
        ("profit", "/ˈprɒfɪt/", "lợi nhuận", "core"),
        ("expense", "/ɪkˈspens/", "chi phí", "core"),
        ("tax", "/tæks/", "thuế", "starter"),
        ("loan", "/ləʊn/", "khoản vay", "core"),
        ("payment", "/ˈpeɪmənt/", "thanh toán", "core"),
        ("balance", "/ˈbæləns/", "số dư", "core"),
        ("deposit", "/dɪˈpɒzɪt/", "tiền gửi", "core"),
        ("transfer", "/trænsˈfɜː/", "chuyển khoản", "core"),
        ("receipt", "/rɪˈsiːt/", "biên lai", "starter"),
    ],
    "technology": [
        ("device", "/dɪˈvaɪs/", "thiết bị", "core"),
        ("software", "/ˈsɒftweə/", "phần mềm", "core"),
        ("update", "/ˈʌpdeɪt/", "cập nhật", "core"),
        ("network", "/ˈnetwɜːk/", "mạng lưới", "core"),
        ("password", "/ˈpɑːswɜːd/", "mật khẩu", "starter"),
        ("install", "/ɪnˈstɔːl/", "cài đặt", "core"),
        ("upload", "/ˈʌpləʊd/", "tải lên", "core"),
        ("download", "/ˈdaʊnləʊd/", "tải xuống", "core"),
        ("server", "/ˈsɜːvə/", "máy chủ", "core"),
        ("backup", "/ˈbækʌp/", "bản sao lưu", "core"),
    ],
    "customer service": [
        ("complaint", "/kəmˈpleɪnt/", "khiếu nại", "core"),
        ("refund", "/ˈriːfʌnd/", "hoàn tiền", "core"),
        ("support", "/səˈpɔːt/", "hỗ trợ", "starter"),
        ("agent", "/ˈeɪdʒənt/", "nhân viên hỗ trợ", "starter"),
        ("respond", "/rɪˈspɒnd/", "phản hồi", "core"),
        ("inquiry", "/ɪnˈkwaɪəri/", "thắc mắc", "core"),
        ("resolve", "/rɪˈzɒlv/", "giải quyết", "core"),
        ("satisfaction", "/ˌsætɪsˈfækʃn/", "sự hài lòng", "advanced"),
        ("policy", "/ˈpɒləsi/", "chính sách", "core"),
        ("request", "/rɪˈkwest/", "yêu cầu", "starter"),
    ],
    "education": [
        ("lesson", "/ˈlesn/", "bài học", "starter"),
        ("teacher", "/ˈtiːtʃə/", "giáo viên", "starter"),
        ("student", "/ˈstjuːdnt/", "học sinh, sinh viên", "starter"),
        ("assignment", "/əˈsaɪnmənt/", "bài tập", "core"),
        ("review", "/rɪˈvjuː/", "ôn tập", "core"),
        ("practice", "/ˈpræktɪs/", "luyện tập", "starter"),
        ("progress", "/ˈprəʊɡres/", "tiến bộ", "core"),
        ("score", "/skɔː/", "điểm số", "starter"),
        ("lecture", "/ˈlektʃə/", "bài giảng", "core"),
        ("tutor", "/ˈtjuːtə/", "gia sư", "core"),
    ],
    "human resources": [
        ("recruit", "/rɪˈkruːt/", "tuyển dụng", "advanced"),
        ("interview", "/ˈɪntəvjuː/", "phỏng vấn", "core"),
        ("training", "/ˈtreɪnɪŋ/", "đào tạo", "core"),
        ("salary", "/ˈsæləri/", "mức lương", "core"),
        ("benefit", "/ˈbenɪfɪt/", "phúc lợi", "core"),
        ("hire", "/haɪə/", "thuê, tuyển", "starter"),
        ("resign", "/rɪˈzaɪn/", "từ chức", "core"),
        ("team", "/tiːm/", "đội nhóm", "starter"),
        ("policy", "/ˈpɒləsi/", "quy định", "core"),
        ("performance", "/pəˈfɔːməns/", "hiệu suất", "advanced"),
    ],
}

TEMPLATES = {
    "business": (
        "The manager approved the report after the meeting.",
        "Người quản lý đã phê duyệt báo cáo sau cuộc họp.",
    ),
    "office": (
        "Please place the file on my desk.",
        "Vui lòng đặt hồ sơ lên bàn làm việc của tôi.",
    ),
    "travel": (
        "We need the passport before departure.",
        "Chúng tôi cần hộ chiếu trước khi khởi hành.",
    ),
    "marketing": (
        "The company launched a new campaign this week.",
        "Công ty đã ra mắt một chiến dịch mới trong tuần này.",
    ),
    "logistics": (
        "The shipment arrived at the warehouse this morning.",
        "Lô hàng đã đến kho hàng sáng nay.",
    ),
    "finance": (
        "Please check the receipt before you pay.",
        "Vui lòng kiểm tra biên lai trước khi thanh toán.",
    ),
    "technology": (
        "The app needs an update tonight.",
        "Ứng dụng cần một bản cập nhật vào tối nay.",
    ),
    "customer service": (
        "The agent handled the complaint politely.",
        "Nhân viên đã xử lý khiếu nại một cách lịch sự.",
    ),
    "education": (
        "The teacher explained the lesson clearly.",
        "Giáo viên đã giải thích bài học rất rõ ràng.",
    ),
    "human resources": (
        "The company will recruit two new staff members.",
        "Công ty sẽ tuyển dụng hai nhân viên mới.",
    ),
}


def build_cards() -> list[dict[str, str]]:
    cards: list[dict[str, str]] = []
    for category, items in WORD_BANK.items():
        english_template, vietnamese_template = TEMPLATES[category]
        for word, ipa, meaning_vi, difficulty in items:
            cards.append(
                {
                    "word": word,
                    "ipa": ipa,
                    "meaning_vi": meaning_vi,
                    "example_en": english_template.format(word=word, meaning=meaning_vi),
                    "example_vi": vietnamese_template.format(word=word, meaning=meaning_vi),
                    "category": category,
                    "difficulty": difficulty,
                }
            )
    return cards


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    cards = build_cards()
    OUTPUT.write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(cards)} flashcards to {OUTPUT}")


if __name__ == "__main__":
    main()
