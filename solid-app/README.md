adeita solid-app

Установка:

```
cd solid-app
npm i
```

Dev:

```
npm run dev
```

Build:

```
npm run build
```

Сборка: solid-app/dist

Интеграция со старым server.js:

1) `npm run build` внутри `solid-app`.
2) В `server.js` добавить статическую раздачу, например по префиксу `/app`:

```
app.use('/app', express.static(path.join(__dirname, 'solid-app', 'dist')));
```

Публичные ассеты берутся из корневого `public/` (настроено в `vite.config.ts` → `publicDir`).

