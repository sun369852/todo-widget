use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent, Listener,
};

// ===== Tauri Commands =====

/// 退出应用
#[tauri::command]
fn quit_app() {
    std::process::exit(0);
}

/// 关闭主窗口 → 显示气泡
#[tauri::command]
fn close_to_bubble(app: tauri::AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
    if let Some(bubble) = app.get_webview_window("bubble") {
        let _ = bubble.show();
    }
}

/// 点击气泡 → 显示主窗口（在气泡附近）
#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
    let mut bubble_pos = None;
    if let Some(bubble) = app.get_webview_window("bubble") {
        if let Ok(pos) = bubble.outer_position() {
            bubble_pos = Some(pos);
        }
        let _ = bubble.hide();
    }
    if let Some(main) = app.get_webview_window("main") {
        // 将主窗口定位到气泡附近（右下角对齐）
        if let Some(pos) = bubble_pos {
            // Bubble window: 100x100, circle center at (50,50)
            let main_x = (pos.x + 50 - 360).max(0);
            let main_y = (pos.y + 50 - 520).max(0);
            let _ = main.set_position(tauri::PhysicalPosition::new(main_x, main_y));
        }
        let _ = main.show();
        let _ = main.set_focus();
    }
}

/// 气泡右键 → 弹出原生系统菜单
#[tauri::command]
fn show_bubble_menu(app: tauri::AppHandle, window: tauri::WebviewWindow) {
    let quit_item = MenuItem::with_id(&app, "bubble-quit", "退出", true, None::<&str>).unwrap();
    let menu = Menu::with_items(&app, &[&quit_item]).unwrap();
    let _ = window.popup_menu(&menu);
}

// ===== App Setup =====

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            quit_app,
            close_to_bubble,
            show_main_window,
            show_bubble_menu,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // 去除窗口装饰和阴影
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.set_decorations(false);
                let _ = main_window.set_shadow(false);
            }
            if let Some(bubble_window) = app.get_webview_window("bubble") {
                let _ = bubble_window.set_decorations(false);
                let _ = bubble_window.set_shadow(false);
            }

            // 创建系统托盘
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_item])?;

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

            // 主窗口关闭事件 → 阻止关闭，隐藏主窗口，显示气泡
            let main_window = app.get_webview_window("main").unwrap();
            let main_window_clone = main_window.clone();
            let app_handle = app.handle().clone();
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = main_window_clone.hide();
                    if let Some(bubble_window) = app_handle.get_webview_window("bubble") {
                        let _ = bubble_window.show();
                    }
                }
            });

            // 气泡窗口关闭事件 → 阻止关闭
            let bubble_window = app.get_webview_window("bubble").unwrap();
            bubble_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                }
            });

            // 处理气泡右键菜单的点击事件
            app.on_menu_event(move |app, event| {
                if event.id.as_ref() == "bubble-quit" {
                    app.exit(0);
                }
            });

            #[cfg(debug_assertions)]
            {
                if let Some(main_win) = app.get_webview_window("main") {
                    main_win.open_devtools();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
