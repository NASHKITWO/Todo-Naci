package io.github.nashkitwo.todo;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;

/** Menjalankan TodoWidgetProvider.build() terhadap kelas Android tiruan dan memeriksa hasilnya. Keluar dengan kode 1 bila ada yang salah. */
public class Harness {
    static final Map<String, String> prefs = new HashMap<String, String>();
    static final String PKG = "io.github.nashkitwo.todo";

    static String day(int off) {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_MONTH, off);
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
    }

    static String it(String t, String u, int off, String h, int p) {
        return "{\"t\":\"" + t + "\",\"u\":\"" + u + "\",\"i\":" + (u.length() > 1 && Character.isDigit(u.charAt(1)) ? (u.charAt(1) - '0') * 10 : 0) + ",\"d\":\"" + day(off) + "\",\"h\":\"" + h + "\",\"p\":" + p + "}";
    }

    static final android.app.NotificationManager nm = new android.app.NotificationManager();
    static final android.app.AlarmManager am = new android.app.AlarmManager();

    static final Context ctx = new Context() {
        public String getPackageName() { return "x"; }
        public Object getSystemService(String n) {
            if (Context.NOTIFICATION_SERVICE.equals(n)) return nm;
            if (Context.ALARM_SERVICE.equals(n)) return am;
            return null;
        }
        public SharedPreferences getSharedPreferences(String n, int m) {
            return new SharedPreferences() {
                public String getString(String k, String d) { return prefs.containsKey(k) ? prefs.get(k) : d; }
                public Editor edit() {
                    return new Editor() {
                        public Editor putString(String k, String v) { prefs.put(k, v); return this; }
                        public Editor remove(String k) { prefs.remove(k); return this; }
                        public void apply() { }
                    };
                }
            };
        }
        public android.content.pm.PackageManager getPackageManager() {
            return new android.content.pm.PackageManager() {
                public Intent getLaunchIntentForPackage(String p) { return new Intent(); }
            };
        }
    };

    static int checks = 0;

    static void check(boolean ok, String what) {
        checks++;
        if (!ok) { System.out.println("GAGAL: " + what); System.exit(1); }
    }

    static String line(int i) { return RemoteViews.text.get(30 + i); }
    static Integer lineVis(int i) { return RemoteViews.vis.get(10 + i); }
    static Integer chkVis(int i) { return RemoteViews.vis.get(20 + i); }
    static String count() { return RemoteViews.text.get(3); }
    static Integer emptyVis() { return RemoteViews.vis.get(4); }

    static void render() { TodoWidgetProvider.build(ctx); }

    static void tap(String uid) {
        Intent i = new Intent();
        i.setAction(TodoWidgetProvider.ACTION_DONE);
        i.putExtra("uid", uid);
        new TodoWidgetProvider().onReceive(ctx, i);
    }

    static void secureTests() {
        TodoWidgetPlugin pl = new TodoWidgetPlugin();
        com.getcapacitor.PluginCall on = new com.getcapacitor.PluginCall(); on.flag = Boolean.TRUE; pl.secure(on);
        check((android.view.Window.flags & android.view.WindowManager.LayoutParams.FLAG_SECURE) != 0, "secure(on) memasang FLAG_SECURE (blokir screenshot/pratinjau)");
        com.getcapacitor.PluginCall off = new com.getcapacitor.PluginCall(); off.flag = Boolean.FALSE; pl.secure(off);
        check((android.view.Window.flags & android.view.WindowManager.LayoutParams.FLAG_SECURE) == 0, "secure(off) melepas FLAG_SECURE");
    }

    public static void main(String[] args) {
        secureTests();
        prefs.put("items", "[" + it("Bayar listrik", "u1", -1, "", 1) + "," + it("Rapat", "u2", 0, "15:00", 2) + "," + it("Nanti", "u3", 3, "", 3) + "]");
        render();
        check(lineVis(1) == 0 && lineVis(2) == 0 && lineVis(3) == 8, "dua baris tampil (terlambat + hari ini), 'Nanti' tersembunyi");
        check(line(1).startsWith("! ") && line(1).contains("Bayar listrik"), "tugas terlambat bertanda '!'");
        check(line(2).contains("15:00  Rapat") && !line(2).startsWith("!"), "jam tampil di depan judul");
        check("2 tugas".equals(count()) && emptyVis() == 8, "hitungan 2 tugas");
        check(RemoteViews.desc.get(21).equals("Selesaikan Bayar listrik"), "deskripsi aksesibilitas pada lingkaran centang");
        check(PendingIntent.made.contains("broadcast#10:" + PKG + ".WIDGET_DONE:u1"), "lingkaran baris 1 mengirim penyelesaian u1");
        check(PendingIntent.made.contains("broadcast#11:" + PKG + ".WIDGET_DONE:u2"), "lingkaran baris 2 mengirim penyelesaian u2");
        check(PendingIntent.made.contains("activity#100:add"), "tombol + membuka aplikasi dengan aksi add");
        check(PendingIntent.made.contains("activity#0:null"), "ketuk widget membuka aplikasi biasa");

        // serangan: aplikasi lain mengirim WIDGET_DONE untuk uid yang tidak tampil, uid sangat panjang, dan tanpa uid
        tap("uid-tidak-dikenal"); tap(new String(new char[500]).replace('\0', 'a'));
        { Intent bad = new Intent(); bad.setAction(TodoWidgetProvider.ACTION_DONE); new TodoWidgetProvider().onReceive(ctx, bad); }
        check(TodoWidgetProvider.pending(ctx).isEmpty(), "siaran palsu (uid tak dikenal/terlalu panjang/kosong) tidak masuk antrean selesai");
        tap("u1");
        check(android.app.NotificationManager.cancelled.equals(Arrays.asList(20, 21)), "centang u1 (id tugas 10): notifikasi terkirim 20 dan 21 dibatalkan");
        check(android.app.NotificationManager.cancelled.size() == 2, "hanya dua id yang dibatalkan");
        check(android.app.AlarmManager.cancelled.equals(Arrays.asList("20:com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher",
            "21:com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher")), "alarm terjadwal id 2n dan 2n+1 dibatalkan lewat penerima plugin");
        check("1 tugas".equals(count()) && lineVis(2) == 8 && line(1).contains("Rapat"), "setelah u1 dicentang: baris hilang, hitungan 1");
        check(prefs.get("done_uids").contains("u1"), "u1 tercatat menunggu diterapkan aplikasi");
        tap("u1");
        check(prefs.get("done_uids").split("u1", -1).length == 2, "centang ganda tidak menggandakan catatan? (satu kemunculan setelah dua tap)");
        tap("u2");
        check(emptyVis() == 0 && "".equals(count()) && lineVis(1) == 8, "semua dicentang: keadaan kosong");
        TodoWidgetProvider.removePending(ctx, new HashSet<String>(Arrays.asList("u1")));
        check(TodoWidgetProvider.pending(ctx).size() == 1 && TodoWidgetProvider.pending(ctx).contains("u2"), "clearCompleted hanya menghapus uid yang disebut");

        prefs.remove("done_uids");
        prefs.put("items", "[" + it("A", "a", 0, "", 1) + "," + it("B", "b", 0, "", 1) + "," + it("C", "c", 0, "", 1) + "," + it("D", "d", 0, "", 1) + ","
            + it("E", "e", 0, "", 1) + "," + it("F", "f", 0, "", 1) + "," + it("G", "g", 0, "", 1) + "]");
        render();
        check("+3 tugas lagi".equals(line(5)) && chkVis(5) == 4 && "7 tugas".equals(count()), "tujuh tugas: baris kelima '+3 tugas lagi' tanpa lingkaran");
        check(lineVis(4) == 0 && line(4).contains("D"), "empat baris pertama tampil");

        prefs.put("items", "[" + it("Besok", "z", 1, "", 2) + "]");
        render();
        check(emptyVis() == 0 && lineVis(1) == 8, "hanya tugas besok: keadaan kosong");

        prefs.put("items", "bukan json");
        render();
        check(emptyVis() == 0 && "".equals(count()), "data rusak: keadaan kosong, tidak crash");

        System.out.println("OK " + checks);
    }
}
