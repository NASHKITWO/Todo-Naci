package android.app; public class Notification {
 public static java.util.List<String> posted = new java.util.ArrayList<>();
 public CharSequence title, text;
 public static class Builder { final Notification n = new Notification(); public Builder(android.content.Context c) {} public Builder(android.content.Context c, String ch) {}
  public Builder setSmallIcon(int i){return this;} public Builder setContentTitle(CharSequence t){n.title=t;return this;} public Builder setContentText(CharSequence t){n.text=t;return this;}
  public Builder setContentIntent(PendingIntent p){return this;} public Builder setAutoCancel(boolean b){return this;} public Notification build(){return n;} } }
