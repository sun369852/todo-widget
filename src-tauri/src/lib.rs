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
    let mut main_pos = None;
    let mut main_size = None;
    let mut main_inner = None;
    if let Some(main) = app.get_webview_window("main") {
        main_pos = main.outer_position().ok();
        main_size = main.outer_size().ok();
        main_inner = main.inner_size().ok();
        let _ = main.hide();
    }
    if let Some(bubble) = app.get_webview_window("bubble") {
        if let (Some(m_pos), Some(m_size), Some(m_inner)) = (main_pos, main_size, main_inner) {
            let scale = bubble.scale_factor().unwrap_or(1.0);
            
            let m_ghost_x = (m_size.width as f64 - m_inner.width as f64) / 2.0;
            let m_ghost_y = (m_size.height as f64 - m_inner.height as f64) / 2.0;
            let m_inner_right = m_pos.x as f64 + m_ghost_x + m_inner.width as f64;
            let m_inner_center_y = m_pos.y as f64 + m_ghost_y + m_inner.height as f64 / 2.0;

            let b_size = bubble.outer_size().unwrap_or(tauri::PhysicalSize::new((60.0*scale) as u32, (60.0*scale) as u32));
            let b_inner = bubble.inner_size().unwrap_or(b_size);
            let b_ghost_x = (b_size.width as f64 - b_inner.width as f64) / 2.0;
            let b_ghost_y = (b_size.height as f64 - b_inner.height as f64) / 2.0;
            
            let b_visual_w = 42.0 * scale;
            let b_visual_h = 42.0 * scale;
            let b_inner_pad_x = (b_inner.width as f64 - b_visual_w) / 2.0;
            let b_inner_pad_y = (b_inner.height as f64 - b_visual_h) / 2.0;
            
            let b_visual_offset_x = b_ghost_x + b_inner_pad_x;
            let b_visual_offset_y = b_ghost_y + b_inner_pad_y;

            let bubble_x = m_inner_right - b_visual_offset_x;
            let bubble_y = m_inner_center_y - (b_visual_h / 2.0) - b_visual_offset_y;

            let _ = bubble.set_position(tauri::PhysicalPosition::new(bubble_x as i32, bubble_y as i32));
        }
        let _ = bubble.show();
    }
}

/// 点击气泡 → 显示主窗口（在气泡附近）
#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
    let mut bubble_pos = None;
    let mut bubble_outer = None;
    let mut bubble_inner = None;
    if let Some(bubble) = app.get_webview_window("bubble") {
        bubble_pos = bubble.outer_position().ok();
        bubble_outer = bubble.outer_size().ok();
        bubble_inner = bubble.inner_size().ok();
        let _ = bubble.hide();
    }
    if let Some(main) = app.get_webview_window("main") {
        if let (Some(pos), Some(b_size), Some(b_inner)) = (bubble_pos, bubble_outer, bubble_inner) {
            let scale = main.scale_factor().unwrap_or(1.0);
            let m_size = main.outer_size().unwrap_or(tauri::PhysicalSize::new(
                (360.0 * scale) as u32,
                (520.0 * scale) as u32,
            ));
            let m_inner = main.inner_size().unwrap_or(m_size);
            let m_ghost_x = (m_size.width as f64 - m_inner.width as f64) / 2.0;
            let m_ghost_y = (m_size.height as f64 - m_inner.height as f64) / 2.0;

            let b_ghost_x = (b_size.width as f64 - b_inner.width as f64) / 2.0;
            let b_ghost_y = (b_size.height as f64 - b_inner.height as f64) / 2.0;
            
            let b_visual_w = 42.0 * scale;
            let b_visual_h = 42.0 * scale;
            let b_inner_pad_x = (b_inner.width as f64 - b_visual_w) / 2.0;
            let b_inner_pad_y = (b_inner.height as f64 - b_visual_h) / 2.0;
            
            let b_visual_offset_x = b_ghost_x + b_inner_pad_x;
            let b_visual_offset_y = b_ghost_y + b_inner_pad_y;

            let bubble_visual_left = pos.x as f64 + b_visual_offset_x;
            let bubble_visual_center_y = pos.y as f64 + b_visual_offset_y + (b_visual_h / 2.0);

            // Main is to the left of the bubble
            let main_x = bubble_visual_left - m_inner.width as f64 - m_ghost_x;
            let main_y = bubble_visual_center_y - (m_inner.height as f64 / 2.0) - m_ghost_y;

            let _ = main.set_position(tauri::PhysicalPosition::new(main_x as i32, main_y as i32));
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
                    
                    let main_pos = main_window_clone.outer_position().ok();
                    let main_size = main_window_clone.outer_size().ok();
                    let _ = main_window_clone.hide();
                    
                    if let Some(bubble) = app_handle.get_webview_window("bubble") {
                        if let (Some(m_pos), Some(m_size), Some(m_inner)) = (main_pos, main_size, main_window_clone.inner_size().ok()) {
                            let scale = bubble.scale_factor().unwrap_or(1.0);
                            
                            let m_ghost_x = (m_size.width as f64 - m_inner.width as f64) / 2.0;
                            let m_ghost_y = (m_size.height as f64 - m_inner.height as f64) / 2.0;
                            let m_inner_right = m_pos.x as f64 + m_ghost_x + m_inner.width as f64;
                            let m_inner_center_y = m_pos.y as f64 + m_ghost_y + m_inner.height as f64 / 2.0;

                            let b_size = bubble.outer_size().unwrap_or(tauri::PhysicalSize::new((60.0*scale) as u32, (60.0*scale) as u32));
                            let b_inner = bubble.inner_size().unwrap_or(b_size);
                            let b_ghost_x = (b_size.width as f64 - b_inner.width as f64) / 2.0;
                            let b_ghost_y = (b_size.height as f64 - b_inner.height as f64) / 2.0;
                            
                            let b_visual_w = 42.0 * scale;
                            let b_visual_h = 42.0 * scale;
                            let b_inner_pad_x = (b_inner.width as f64 - b_visual_w) / 2.0;
                            let b_inner_pad_y = (b_inner.height as f64 - b_visual_h) / 2.0;
                            
                            let b_visual_offset_x = b_ghost_x + b_inner_pad_x;
                            let b_visual_offset_y = b_ghost_y + b_inner_pad_y;

                            let bubble_x = m_inner_right - b_visual_offset_x;
                            let bubble_y = m_inner_center_y - (b_visual_h / 2.0) - b_visual_offset_y;

                            let _ = bubble.set_position(tauri::PhysicalPosition::new(bubble_x as i32, bubble_y as i32));
                        }
                        let _ = bubble.show();
                    }
                }
            });

            // 气泡窗口边缘防丢失吸附 (Screen Clamp)
            let bubble_window = app.get_webview_window("bubble").unwrap();
            let bw_clone = bubble_window.clone();
            bubble_window.on_window_event(move |event| {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                    }
                    WindowEvent::Moved(pos) => {
                        if let Ok(Some(monitor)) = bw_clone.current_monitor() {
                            let m_pos = monitor.position();
                            let m_size = monitor.size();
                            
                            let scale = bw_clone.scale_factor().unwrap_or(1.0);
                            let b_size = bw_clone.outer_size().unwrap_or(tauri::PhysicalSize::new((60.0*scale) as u32, (60.0*scale) as u32));
                            let b_inner = bw_clone.inner_size().unwrap_or(b_size);
                            let b_ghost_x = (b_size.width as f64 - b_inner.width as f64) / 2.0;
                            let b_ghost_y = (b_size.height as f64 - b_inner.height as f64) / 2.0;
                            
                            let b_visual_w = 42.0 * scale;
                            let b_visual_h = 42.0 * scale;
                            let b_inner_pad_x = (b_inner.width as f64 - b_visual_w) / 2.0;
                            let b_inner_pad_y = (b_inner.height as f64 - b_visual_h) / 2.0;
                            
                            let b_visual_offset_x = b_ghost_x + b_inner_pad_x;
                            let b_visual_offset_y = b_ghost_y + b_inner_pad_y;

                            let mut new_x = pos.x as f64;
                            let mut new_y = pos.y as f64;
                            let mut clamped = false;

                            let min_x = m_pos.x as f64 - b_visual_offset_x;
                            let max_x = m_pos.x as f64 + m_size.width as f64 - b_visual_offset_x - b_visual_w;
                            
                            let min_y = m_pos.y as f64 - b_visual_offset_y;
                            let max_y = m_pos.y as f64 + m_size.height as f64 - b_visual_offset_y - b_visual_h;

                            if new_x < min_x - 0.5 { new_x = min_x; clamped = true; }
                            else if new_x > max_x + 0.5 { new_x = max_x; clamped = true; }

                            if new_y < min_y - 0.5 { new_y = min_y; clamped = true; }
                            else if new_y > max_y + 0.5 { new_y = max_y; clamped = true; }

                            if clamped {
                                let _ = bw_clone.set_position(tauri::PhysicalPosition::new(new_x as i32, new_y as i32));
                            }
                        }
                    }
                    _ => {}
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
