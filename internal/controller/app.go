package controller_app

import (
	"context"

	"fyne.io/systray"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx      context.Context
	trayIcon []byte
	quitting bool
}

func NewApp(trayIcon []byte) *App {
	return &App{trayIcon: trayIcon}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	runtime.InitializeNotifications(ctx)
	go systray.Run(a.onTrayReady, func() {})
}

// BeforeClose intercepts window close — hides to tray instead of quitting.
// Returns true to prevent destruction.
func (a *App) BeforeClose(ctx context.Context) bool {
	if a.quitting {
		return false
	}
	runtime.WindowHide(ctx)
	_ = runtime.SendNotification(ctx, runtime.NotificationOptions{
		ID:    "kube-ins-tray",
		Title: "kube-ins çalışmaya devam ediyor",
		Body:  "Uygulama arka planda çalışıyor. Kapatmak için tray ikonuna sağ tıklayın.",
	})
	return true
}

func (a *App) onTrayReady() {
	systray.SetIcon(a.trayIcon)
	systray.SetTooltip("kube-ins")

	mShow := systray.AddMenuItem("kube-ins'i Aç", "Pencereyi göster")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Çıkış", "Uygulamayı kapat")

	for {
		select {
		case <-mShow.ClickedCh:
			runtime.WindowShow(a.ctx)
		case <-mQuit.ClickedCh:
			a.quitting = true
			systray.Quit()
			runtime.Quit(a.ctx)
			return
		}
	}
}
