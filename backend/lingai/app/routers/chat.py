import re

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, ChatMessage
from app.schemas.schemas import ChatMessageIn, ChatMessageOut

router = APIRouter(prefix="/api/chat", tags=["AI Chat"])

SYSTEM_PROMPT = """You are Pengwin Coach, a practical English tutor.
Always follow the user's latest instruction.
Core behaviors:
1. If user asks to write (paragraph/email/essay), write directly in requested language and length.
2. If user asks to translate, return only the translation unless user asks for explanation.
3. If user asks to correct grammar, provide corrections + short explanation.
4. If user asks general questions, answer clearly and concisely.
5. Never return rigid templates like "Original/Corrected/Why" unless the user explicitly asks for grammar correction format.
6. Never ask the user to choose from numbered options unless the user explicitly asks for options.
Tone: friendly, specific, and encouraging.
"""


def _history_messages(db: Session, user_id: int, limit: int = 12) -> list[dict[str, str]]:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()

    formatted = []
    for row in rows:
        role = "assistant" if row.role == "assistant" else "user"
        formatted.append({"role": role, "content": row.content})
    return formatted


def _call_llm(user_text: str, system_prompt: str, history: list[dict[str, str]]) -> tuple[str | None, str | None]:
    key = (settings.LLM_API_KEY or "").strip()
    if not key:
        return None, "missing_key"
    if key.upper().startswith("YOUR_REAL_API_KEY"):
        return None, "placeholder_key"

    provider = (settings.LLM_PROVIDER or "groq").strip().lower()

    try:
        with httpx.Client(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
            if provider == "gemini":
                # Gemini native endpoint (v1beta).
                endpoint = (
                    settings.LLM_BASE_URL.rstrip("/")
                    + f"/models/{settings.LLM_MODEL}:generateContent"
                )

                gemini_history = []
                for msg in history:
                    role = "model" if msg.get("role") == "assistant" else "user"
                    gemini_history.append(
                        {
                            "role": role,
                            "parts": [{"text": msg.get("content", "")}],
                        }
                    )

                payload = {
                    "system_instruction": {
                        "parts": [{"text": system_prompt}],
                    },
                    "contents": [
                        *gemini_history,
                        {"role": "user", "parts": [{"text": user_text}]},
                    ],
                    "generationConfig": {
                        "temperature": 0.4,
                    },
                }

                response = client.post(
                    endpoint,
                    params={"key": key},
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                data = response.json()

                candidate = (data.get("candidates") or [{}])[0]
                parts = ((candidate.get("content") or {}).get("parts") or [])
                text = "".join(
                    part.get("text", "") for part in parts if isinstance(part, dict)
                ).strip()
                return (text or None), None

            # Default: OpenAI-compatible chat/completions APIs (OpenAI/Groq).
            endpoint = settings.LLM_BASE_URL.rstrip("/") + "/chat/completions"
            messages = [
                {"role": "system", "content": system_prompt},
                *history,
                {"role": "user", "content": user_text},
            ]

            payload = {
                "model": settings.LLM_MODEL,
                "messages": messages,
                "temperature": 0.4,
            }
            headers = {
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json",
            }

            response = client.post(endpoint, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

            choice = (data.get("choices") or [{}])[0]
            message = choice.get("message") or {}
            content = message.get("content")

            if isinstance(content, str):
                text = content.strip()
                return (text or None), None

            if isinstance(content, list):
                parts = [part.get("text", "") for part in content if isinstance(part, dict)]
                text = "".join(parts).strip()
                return (text or None), None
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        body = (e.response.text or "").lower()
        if status == 429:
            return None, "quota_exceeded"
        if status in (401, 403):
            return None, "invalid_key_or_permission"
        if status == 404:
            return None, "model_or_endpoint_not_found"
        if "quota" in body or "resource_exhausted" in body:
            return None, "quota_exceeded"
        return None, f"http_{status}"
    except httpx.TimeoutException:
        return None, "timeout"
    except Exception:
        return None, "unknown"

    return None, "empty_response"


def _coach_reply(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return "Hey! Bạn cứ nhắn tự nhiên nhé, mình sẽ hỗ trợ như một người bạn luyện tiếng Anh."

    lower = raw.lower()

    # Intent routing (high priority): if user asks clearly, do it directly.
    wants_write = (
        ("write" in lower and ("paragraph" in lower or "essay" in lower))
        or ("viết" in lower and ("đoạn" in lower or "đoạn văn" in lower))
    )
    wants_translate = "dịch" in lower or "translate" in lower
    wants_english_output = (
        "bằng tiếng anh" in lower
        or "in english" in lower
        or ("english" in lower and ("viết" in lower or "write" in lower or "cho tôi" in lower))
    )
    correction_triggers = [
        "sửa", "sửa giúp", "sửa ngữ pháp", "correct", "fix grammar", "grammar check", "proofread"
    ]
    wants_correction = any(trigger in lower for trigger in correction_triggers)

    # Practical intent: weather/temperature requests.
    weather_keywords = ["weather", "temperature", "nhiệt độ", "thời tiết", "tomorrow", "ngày mai"]
    wants_weather = any(k in lower for k in weather_keywords)
    if wants_weather:
        if wants_english_output:
            return (
                "Sure! I can help with tomorrow's temperature in English. "
                "Please tell me your city (for example: Hanoi, Da Nang, or Ho Chi Minh City), "
                "and I will give you a short weather summary."
            )
        return (
            "Được nhé! Mình có thể báo nhiệt độ ngày mai. "
            "Bạn cho mình tên thành phố (ví dụ: Hà Nội, Đà Nẵng, TP.HCM), "
            "mình sẽ trả lời ngay bằng tiếng Anh nếu bạn muốn."
        )

    # Practical intent: direct information requests.
    info_match = re.search(
        r"(?:thông\s*tin\s*về|giới\s*thiệu\s*về|tell\s*me\s*about|information\s*about)\s+(.+)$",
        raw,
        flags=re.IGNORECASE,
    )
    if info_match and not wants_correction:
        topic = info_match.group(1).strip(" .?!")
        if wants_english_output:
            return (
                f"Sure! Here is a quick overview of {topic}: "
                f"{topic[:1].upper() + topic[1:] if topic else 'This topic'} is important in daily life. "
                "It is useful to understand key ideas, common examples, and practical applications. "
                "If you want, I can also explain it in simpler English or give a short vocabulary list."
            )
        return (
            f"Mình có thể cung cấp thông tin về {topic}. "
            "Nếu bạn muốn bằng tiếng Anh, mình sẽ viết bản ngắn gọn dễ hiểu ngay."
        )

    if wants_write:
        topic_match = re.search(r"(?:about|on|về)\s+(.+)$", raw, flags=re.IGNORECASE)
        topic = topic_match.group(1).strip(" .") if topic_match else "travel"

        words_match = re.search(r"(\d+)\s*(?:chữ|từ|words?)", lower)
        target_words = int(words_match.group(1)) if words_match else 50
        target_words = max(35, min(target_words, 120))

        if target_words <= 65:
            return (
                f"Travel helps us discover new places, people, and cultures. During a trip, we can taste local food, "
                f"visit famous landmarks, and create unforgettable memories with friends or family. Travel also teaches "
                f"us to be flexible and open-minded. That is why {topic if topic else 'travel'} is meaningful and inspiring."
            )

        return (
            f"Travel is one of the best ways to learn about the world. When we travel, we meet new people, explore different cultures, "
            f"and understand local traditions. We can try special food, visit historical places, and enjoy beautiful landscapes. "
            f"Travel also improves communication skills and helps us become more confident. In my opinion, {topic if topic else 'travel'} "
            f"is not only enjoyable but also educational, because every journey gives us valuable lessons and memorable experiences."
        )

    if wants_translate:
        candidate = raw
        marker_patterns = [
            r"dịch\s*(?:câu\s*này|đoạn\s*này)?\s*[:：]\s*(.+)$",
            r"translate\s*(?:this\s*(?:sentence|paragraph))?\s*[:：]\s*(.+)$",
        ]
        for pattern in marker_patterns:
            match = re.search(pattern, raw, flags=re.IGNORECASE)
            if match:
                candidate = match.group(1).strip()
                break

        # If user asks to translate without providing source text, ask for it explicitly.
        if candidate == raw and len(raw.split()) <= 6:
            return "Please provide the exact sentence you want me to translate. Example: Translate: Tôi thích học tiếng Anh mỗi ngày."

        # Heuristic fallback translation style when no external LLM is configured.
        return (
            "I can translate accurately when AI mode is enabled.\n"
            f"Text to translate: {candidate}\n"
            "Please set LLM_API_KEY in backend/.env, then I will translate this exact text for you immediately."
        )

    # Friendly small-talk path: do not force grammar-correction format.
    greetings = {
        "chào", "chào cậu", "chào bạn", "hello", "hi", "hey", "helo", "xin chào"
    }
    if lower in greetings or re.fullmatch(r"(hi+|hello+|hey+|chào+)[.!? ]*", lower):
        if any(ch in lower for ch in ["chào", "xin"]):
            return "Chào cậu nha 👋 Hôm nay mình giúp gì cho cậu? Muốn luyện nói, viết hay sửa câu tiếng Anh?"
        return "Hi there 👋 Great to see you! Do you want to practice speaking, writing, or grammar today?"

    if not wants_correction:
        # Conversational fallback in Vietnamese if message looks Vietnamese, else English.
        vietnamese_markers = [
            "đ", "ă", "â", "ê", "ô", "ơ", "ư", "á", "à", "ả", "ã", "ạ",
            "nhé", "mình", "bạn", "không", "cậu", "được", "giúp"
        ]
        is_vi = any(marker in lower for marker in vietnamese_markers)

        # If user asks info about a topic in a free-form way, answer directly.
        generic_topic_match = re.search(
            r"(?:về|about)\s+(.+)$",
            raw,
            flags=re.IGNORECASE,
        )
        if generic_topic_match:
            topic = generic_topic_match.group(1).strip(" .?!")
            if wants_english_output:
                return (
                    f"Sure. Here are some quick points about {topic}: "
                    f"{topic[:1].upper() + topic[1:] if topic else 'It'} affects daily life in many ways. "
                    "People often care about practical impact, current trends, and simple actions they can take. "
                    "If you want, I can give a more detailed version for school, work, or casual conversation."
                )
            return (
                f"Mình hiểu bạn đang hỏi về {topic}. "
                "Mình có thể trả lời ngắn gọn, thực tế, và đúng mục đích bạn cần. "
                "Nếu muốn, mình sẽ viết ngay bản bằng tiếng Anh ở mức dễ hiểu."
            )

        if is_vi:
            return "Mình hiểu ý của bạn 👍 Bạn nói rõ thêm 1 chút mục tiêu (ví dụ: cần cho bài tập, công việc hay giao tiếp hằng ngày), mình sẽ trả lời đúng trọng tâm ngay."
        return (
            "Got it 👍 I can help with that directly. "
            "Share one more detail about your goal (school, work, or daily conversation), and I’ll give a precise answer."
        )

    corrected = raw
    notes: list[str] = []

    rules = [
        (r"\b[Ii]\s+go\b", "I went", "Use past tense for completed actions in the past."),
        (r"\b[Ii]\s+have\s+been\s+to\b", "I went to", "Use past simple with a finished time marker like 'last year'."),
        (r"\b([Hh]e|[Ss]he|[Ii]t)\s+don't\b", r"\1 doesn't", "Third-person singular uses 'doesn't', not 'don't'."),
        (r"\bmore\s+taller\b", "taller", "Do not use double comparatives (more + -er)."),
        (r"\bmore\s+better\b", "better", "Use 'better' directly; it is already comparative."),
        (r"\badvices\b", "advice", "'Advice' is uncountable in English."),
        (r"\bhomeworks\b", "homework", "'Homework' is uncountable in English."),
    ]

    for pattern, replacement, explanation in rules:
        new_text = re.sub(pattern, replacement, corrected)
        if new_text != corrected:
            corrected = new_text
            notes.append(explanation)

    if not re.search(r"[.!?]$", corrected):
        corrected += "."

    # Simple naturalness cleanups.
    corrected = re.sub(r"\bi\b", "I", corrected)
    corrected = re.sub(r"\s+", " ", corrected).strip()

    if corrected == raw and not notes:
        return f"Câu này ổn rồi nè ✅\nNếu muốn tự nhiên hơn một chút, cậu có thể viết: {corrected}"

    unique_notes = []
    seen = set()
    for note in notes:
        if note not in seen:
            unique_notes.append(note)
            seen.add(note)

    why = "\n".join(f"- {item}" for item in unique_notes) if unique_notes else "- Improved punctuation and sentence flow."

    return (
        f"Mình sửa lại tự nhiên hơn như này nhé:\n{corrected}\n\n"
        f"Giải thích ngắn:\n{why}\n\n"
        "Nếu cậu muốn, mình sẽ gợi ý thêm 2 cách nói khác để cậu chọn tone cho hợp ngữ cảnh."
    )


@router.get("/history", response_model=list[ChatMessageOut])
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at)
        .limit(100)
        .all()
    )
    return messages


@router.post("/send", response_model=ChatMessageOut)
def send_message(
    payload: ChatMessageIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save user message. AI response is generated by the frontend calling
    the /chat/ai-response endpoint or via a real LLM integration.
    This endpoint handles persistence.
    """
    msg = ChatMessage(user_id=current_user.id, role="user", content=payload.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/ai-response", response_model=ChatMessageOut)
def save_ai_response(
    payload: ChatMessageIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save the AI assistant's response to the DB."""
    msg = ChatMessage(user_id=current_user.id, role="assistant", content=payload.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/generate", response_model=ChatMessageOut)
def generate_ai_response(
    payload: ChatMessageIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and save AI response using prompt + history + configured LLM."""
    custom_prompt = (payload.system_prompt or "").strip()
    system_prompt = custom_prompt if custom_prompt else SYSTEM_PROMPT

    history = _history_messages(db, current_user.id)
    ai_text, llm_error = _call_llm(payload.content, system_prompt, history)

    if not ai_text:
        provider = (settings.LLM_PROVIDER or "groq").strip().lower()
        if provider == "gemini":
            key = (settings.LLM_API_KEY or "").strip()
            if not key or key.upper().startswith("YOUR_REAL_API_KEY"):
                ai_text = (
                    "Gemini chưa được cấu hình API key thật. "
                    "Bạn mở backend/lingai/.env và thay LLM_API_KEY=YOUR_REAL_API_KEY bằng key Gemini thật, rồi restart backend."
                )
            elif llm_error == "quota_exceeded":
                ai_text = (
                    "Gemini báo hết quota (RESOURCE_EXHAUSTED / 429). "
                    "Bạn cần bật billing hoặc chờ reset quota rồi thử lại."
                )
            elif llm_error == "invalid_key_or_permission":
                ai_text = (
                    "Gemini từ chối xác thực (401/403). "
                    "Hãy kiểm tra lại API key, project và quyền truy cập Gemini API."
                )
            elif llm_error == "model_or_endpoint_not_found":
                ai_text = (
                    "Model hoặc endpoint Gemini không tồn tại (404). "
                    "Hãy kiểm tra LLM_BASE_URL và LLM_MODEL trong backend/lingai/.env."
                )
            else:
                ai_text = (
                    "Gemini đang bật nhưng gọi API bị lỗi. "
                    "Hãy kiểm tra key còn hiệu lực, billing/quota, model gemini-2.0-flash và kết nối mạng máy chủ."
                )
        elif provider == "openai":
            key = (settings.LLM_API_KEY or "").strip()
            if not key or key.upper().startswith("YOUR_REAL_API_KEY"):
                ai_text = (
                    "OpenAI chưa được cấu hình API key thật. "
                    "Bạn mở backend/lingai/.env và cập nhật LLM_API_KEY, rồi restart backend."
                )
            else:
                ai_text = (
                    "OpenAI đang bật nhưng gọi API bị lỗi. "
                    "Hãy kiểm tra key, model, quota và kết nối mạng máy chủ."
                )
        elif provider == "groq":
            key = (settings.LLM_API_KEY or "").strip()
            if not key or key.upper().startswith("YOUR_REAL_API_KEY"):
                ai_text = (
                    "Groq chưa được cấu hình API key thật. "
                    "Bạn mở backend/lingai/.env, đặt LLM_PROVIDER=groq và dán Groq key vào LLM_API_KEY, rồi restart backend."
                )
            elif llm_error == "quota_exceeded":
                ai_text = (
                    "Groq báo hết quota/tốc độ tạm thời (429). "
                    "Bạn chờ một lúc rồi thử lại, hoặc đổi model nhẹ hơn trong LLM_MODEL."
                )
            elif llm_error == "invalid_key_or_permission":
                ai_text = (
                    "Groq từ chối xác thực (401/403). "
                    "Hãy kiểm tra lại Groq API key và quyền truy cập model."
                )
            elif llm_error == "model_or_endpoint_not_found":
                ai_text = (
                    "Model hoặc endpoint Groq không tồn tại (404). "
                    "Hãy kiểm tra LLM_BASE_URL và LLM_MODEL trong backend/lingai/.env."
                )
            else:
                ai_text = (
                    "Groq đang bật nhưng gọi API bị lỗi. "
                    "Hãy kiểm tra key, model, hạn mức miễn phí và kết nối mạng máy chủ."
                )
        else:
            ai_text = (
                "LLM_PROVIDER chưa hợp lệ. "
                "Hãy đặt LLM_PROVIDER=groq hoặc LLM_PROVIDER=gemini hoặc LLM_PROVIDER=openai trong backend/lingai/.env."
            )

    msg = ChatMessage(user_id=current_user.id, role="assistant", content=ai_text)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/system-prompt")
def get_system_prompt(_: User = Depends(get_current_user)):
    """Return the system prompt for frontend LLM calls."""
    return {"system_prompt": SYSTEM_PROMPT}


@router.delete("/history", status_code=204)
def clear_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete()
    db.commit()
