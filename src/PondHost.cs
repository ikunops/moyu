
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

public class PondHost {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string c, string n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cls, string win);
  [DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr c, IntPtr p);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr r);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int m);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr c);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SetWindowsHookEx(int id, HookProc fn, IntPtr mod, uint tid);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool UnhookWindowsHookEx(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr CallNextHookEx(IntPtr h, int code, IntPtr wp, IntPtr lp);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr GetModuleHandle(string n);

  public delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct MSLLHOOKSTRUCT {
    public int x, y; public uint mouseData, flags, time; public IntPtr dwExtraInfo;
  }

  const int WH_MOUSE_LL = 14;
  const int WM_MOUSEMOVE = 0x0200, WM_LBUTTONDOWN = 0x0201, WM_LBUTTONUP = 0x0202,
            WM_LBUTTONDBLCLK = 0x0203, WM_RBUTTONDOWN = 0x0204;

  static WebView2 wv; static Form form; static string appDir, logFile;
  static IntPtr hook = IntPtr.Zero;
  static HookProc hookProc;                     // 保持引用，防 GC
  static int lastMoveSent = 0;
  static int lastClickMs = 0;
  static int SCRW = 0, SCRH = 0;
  static readonly object lk = new object();

  static void L(string s) {
    lock (lk) { try { File.AppendAllText(logFile, DateTime.Now.ToString("HH:mm:ss.fff ") + s + "\r\n", Encoding.UTF8); } catch { } }
  }

  static void Send(string json) {
    try { if (wv != null && wv.CoreWebView2 != null) wv.CoreWebView2.PostWebMessageAsJson(json); } catch { }
  }

  static IntPtr HookFn(int code, IntPtr wParam, IntPtr lParam) {
    if (code >= 0) {
      try {
        var d = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
        int msg = wParam.ToInt32();
        if (msg == WM_MOUSEMOVE) {
          // 节流：最多 ~40 次/秒
          int now = Environment.TickCount;
          if (now - lastMoveSent >= 25) {
            lastMoveSent = now;
            Send("{\"t\":\"m\",\"x\":" + d.x + ",\"y\":" + d.y + ",\"w\":" + SCRW + ",\"h\":" + SCRH + "}");
          }
        } else if (msg == WM_LBUTTONDOWN) {
          lastClickMs = Environment.TickCount;
          L("click at " + d.x + "," + d.y);
          Send("{\"t\":\"c\",\"x\":" + d.x + ",\"y\":" + d.y + ",\"w\":" + SCRW + ",\"h\":" + SCRH + ",\"d\":0}");
        } else if (msg == WM_LBUTTONDBLCLK) {
          L("dblclick at " + d.x + "," + d.y);
          Send("{\"t\":\"c\",\"x\":" + d.x + ",\"y\":" + d.y + ",\"w\":" + SCRW + ",\"h\":" + SCRH + ",\"d\":1}");
        } else if (msg == WM_RBUTTONDOWN) {
          Send("{\"t\":\"r\",\"x\":" + d.x + ",\"y\":" + d.y + ",\"w\":" + SCRW + ",\"h\":" + SCRH + "}");
        }
      } catch { }
    }
    return CallNextHookEx(hook, code, wParam, lParam);
  }

  [STAThread]
  public static void Main(string[] args) {
    appDir = AppDomain.CurrentDomain.BaseDirectory;
    logFile = Path.Combine(appDir, "host.log");
    try { File.WriteAllText(logFile, "", Encoding.UTF8); } catch { }
    SetProcessDpiAwarenessContext(new IntPtr(-4));
    SCRW = GetSystemMetrics(0); SCRH = GetSystemMetrics(1);
    L("start screen=" + SCRW + "x" + SCRH);

    form = new Form();
    form.FormBorderStyle = FormBorderStyle.None;
    form.StartPosition = FormStartPosition.Manual;
    form.Bounds = new Rectangle(0, 0, SCRW, SCRH);
    form.ShowInTaskbar = false;
    form.BackColor = Color.FromArgb(10, 30, 38);

    wv = new WebView2(); wv.Dock = DockStyle.Fill;
    form.Controls.Add(wv);

    form.Shown += async (s, e) => { await Boot(); };
    Application.Run(form);
  }

  static async Task Boot() {
    try {
      var opt = new CoreWebView2EnvironmentOptions(
        "--disable-gpu-compositing --disable-features=CalculateNativeWinOcclusion " +
        "--disable-backgrounding-occluded-windows --disable-renderer-backgrounding");
      var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(appDir, "udf"), opt);
      await wv.EnsureCoreWebView2Async(env);
      L("core ok " + env.BrowserVersionString);
      wv.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
      wv.CoreWebView2.Settings.IsStatusBarEnabled = false;
      wv.CoreWebView2.SetVirtualHostNameToFolderMapping("pond.local", appDir, CoreWebView2HostResourceAccessKind.Allow);

      var tcs = new TaskCompletionSource<bool>();
      wv.CoreWebView2.NavigationCompleted += (a, b) => { L("nav ok=" + b.IsSuccess); tcs.TrySetResult(true); };
      wv.CoreWebView2.Navigate("http://pond.local/index.html");
      await tcs.Task;
      await Task.Delay(2200);

      // ---- 挂进桌面壁纸层（图标下面，观赏效果好）----
      IntPtr pm = FindWindow("Progman", null);
      IntPtr r; SendMessageTimeout(pm, 0x052C, new IntPtr(0x0D), new IntPtr(0x01), 0, 1000, out r);
      Thread.Sleep(300);
      var kids = new List<IntPtr>();
      IntPtr child = IntPtr.Zero;
      do {
        child = FindWindowEx(pm, child, null, null);
        if (child != IntPtr.Zero) {
          var sb = new StringBuilder(64); GetClassName(child, sb, 64);
          if (sb.ToString() == "WorkerW") kids.Add(child);
        }
      } while (child != IntPtr.Zero);
      IntPtr wall = kids.Count > 0 ? kids[kids.Count - 1] : pm;
      int ex = GetWindowLong(form.Handle, -20);
      SetWindowLong(form.Handle, -20, ex | 0x08000000 | 0x00000080);
      SetParent(form.Handle, wall);
      SetWindowPos(form.Handle, new IntPtr(1), 0, 0, SCRW, SCRH, 0x0010 | 0x0040 | 0x0004);
      L("wallpaper parented wall=" + wall);

      // ---- 全局鼠标钩子：壁纸层收不到鼠标，用钩子捕获并转发 ----
      hookProc = new HookProc(HookFn);
      hook = SetWindowsHookEx(WH_MOUSE_LL, hookProc, GetModuleHandle(null), 0);
      L("mouse hook=" + hook + " err=" + Marshal.GetLastWin32Error());

      L("ready");
    } catch (Exception ex) {
      L("ERR " + ex.GetType().Name + ": " + ex.Message);
    }
  }
}
