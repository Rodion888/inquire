# Inquire

> Визуальный инструмент для исследования тем через интерактивный граф знаний

**Путь:** `/Users/rodion/Desktop/apps/inquire`

**Вдохновение:** [rabbithole.chat](https://www.rabbithole.chat/)

## Быстрый старт

```bash
# Перейти в папку проекта
cd ~/Desktop/apps/inquire

# Переключить Node.js на нужную версию (20)
nvm use

# Установить зависимости (если нужно)
pnpm install

# Запустить dev сервер
pnpm dev
```

Откроется на http://localhost:3000

## Концепт

```
Вопрос → AI генерит ответ + связи → Визуальный граф → Клик → Погружение глубже
```

## Стек

| Технология | Назначение |
|------------|------------|
| Next.js 14 | App Router, SSR |
| TypeScript | Типизация |
| CSS Modules | Стили с изоляцией |
| @tanstack/react-query | Кэширование запросов, loading states |
| Gemini API | Генерация контента |
| Firebase | Hosting + Firestore + Auth |
| pnpm | Пакетный менеджер |
| Node.js 20 | Runtime (через .nvmrc) |

## Архитектура — Feature-Sliced Design

```
src/
├── app/                      # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx              # Главная
│   ├── explore/[id]/
│   │   └── page.tsx          # Визуализация
│   └── globals.css
│
├── widgets/                  # Самостоятельные блоки UI
│   └── header/
│
├── features/                 # Пользовательские сценарии
│   ├── create-exploration/   # Ввод темы → старт исследования
│   ├── expand-node/          # Клик по связи → углубление
│   └── generate-content/     # Запрос к Gemini
│
├── entities/                 # Бизнес-сущности
│   ├── card/                 # Карточка с контентом
│   └── topic/                # Связанная тема
│
└── shared/                   # Переиспользуемое
    ├── ui/                   # Базовые компоненты (Button, Input)
    ├── api/                  # Firebase, Gemini клиенты
    ├── lib/                  # Утилиты
    └── config/               # Константы, env
```

### Правило импортов FSD

```
app → widgets → features → entities → shared
```

Импорт только из слоёв ниже.

## Принципы разработки

1. **Семантическая вёрстка** — header, nav, main, article, section
2. **Composition over Inheritance** — компоненты через композицию
3. **Single Responsibility** — один компонент = одна задача
4. **Колокейшн** — связанный код рядом (стили, типы)
5. **Явные зависимости** — импорт через index.ts
6. **DRY без фанатизма** — абстрагируй когда 3+ повторений
7. **Типизация на максимум** — пропсы, API ответы
8. **Доступность (a11y)** — клавиатура, aria-label, контраст

## План разработки

### Фаза 1 — Фундамент ✅
- [x] Init Next.js + TypeScript + pnpm
- [x] Структура папок FSD
- [x] CSS переменные и базовые стили
- [x] Настройка путей (@/ алиасы)
- [x] .nvmrc для Node.js 20

### Фаза 2 — Shared слой
- [ ] shared/ui: Button, Input
- [ ] shared/config: env переменные
- [ ] shared/api: базовая структура

### Фаза 3 — Главная страница
- [ ] widgets/header
- [ ] features/create-exploration (форма ввода)
- [ ] Примеры тем
- [ ] Роутинг на /explore

### Фаза 4 — Ядро
- [ ] shared/api/gemini: клиент Gemini API
- [ ] features/generate-content: генерация через react-query
- [ ] entities/card: компонент карточки
- [ ] entities/topic: связанные темы
- [ ] SVG линии между карточками
- [ ] features/expand-node: углубление по клику

### Фаза 5 — Данные
- [ ] Firebase проект
- [ ] Firestore: сохранение исследований
- [ ] Auth (опционально)

### Фаза 6 — Деплой
- [ ] Firebase Hosting

## Переменные окружения

```env
NEXT_PUBLIC_GEMINI_API_KEY=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
```

---

*Создано: 2026-02-04*
