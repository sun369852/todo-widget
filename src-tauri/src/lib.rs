use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent, Listener,
};

#[tauri::command]
fn quit_app() {
    std::process::exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![quit_app])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // Force window configurations to remove decorations and shadows
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.set_decorations(false);
                let _ = main_window.set_shadow(false);
            }
            if let Some(bubble_window) = app.get_webview_window("bubble") {
                let _ = bubble_window.set_decorations(false);
                let _ = bubble_window.set_shadow(false);
            }
            // Create tray menu
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_item])?;

            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "quit" {
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(main_window) = app.get_webview_window("main") {
                            if main_window.is_visible().unwrap_or(false) {
                                let _ = main_window.hide();
                            } else {
                                let _ = main_window.show();
                                let _ = main_window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Handle main window close event - hide main and show bubble
            let main_window = app.get_webview_window("main").unwrap();
            let main_window_clone = main_window.clone();
            let app_handle = app.handle().clone();
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = main_window_clone.hide();
                    // Show bubble window
                    if let Some(bubble_window) = app_handle.get_webview_window("bubble") {
                        let _ = bubble_window.show();
                    }
                }
            });

            // Handle bubble window close event - hide bubble and show main
            let bubble_window = app.get_webview_window("bubble").unwrap();
            bubble_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                }
            });

            // Listen for bubble click event from frontend
            let app_handle3 = app.handle().clone();
            app.listen("show-main", move |_| {
                if let Some(bubble) = app_handle3.get_webview_window("bubble") {
                    let _ = bubble.hide();
                }
                if let Some(main) = app_handle3.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }
            });

            // Listen for show-bubble event from frontend
            let app_handle4 = app.handle().clone();
            app.listen("show-bubble", move |_| {
                if let Some(main) = app_handle4.get_webview_window("main") {
                    let _ = main.hide();
                }
                if let Some(bubble) = app_handle4.get_webview_window("bubble") {
                    let _ = bubble.show();
                }
            });

            // Listen for quit-app event from frontend (right-click bubble)
            app.listen("quit-app", |_| {
                std::process::exit(0);
            });

            #[cfg(debug_assertions)]
            {
                main_window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
