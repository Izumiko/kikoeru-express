CREATE TABLE `t_history` (
	`id` integer PRIMARY KEY,
	`user_name` text NOT NULL,
	`work_id` integer NOT NULL,
	`file_index` text NOT NULL,
	`file_name` text,
	`play_time` integer,
	`total_time` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_t_history_user_name_t_user_name_fk` FOREIGN KEY (`user_name`) REFERENCES `t_user`(`name`) ON DELETE CASCADE,
	CONSTRAINT `fk_t_history_work_id_t_work_id_fk` FOREIGN KEY (`work_id`) REFERENCES `t_work`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `t_history_unique` ON `t_history` (`user_name`,`work_id`,`file_index`);
--> statement-breakpoint
ALTER TABLE `t_work` ADD `insert_time` text;--> statement-breakpoint
UPDATE `t_work` SET `insert_time` = CURRENT_TIMESTAMP WHERE `insert_time` IS NULL;--> statement-breakpoint
DROP VIEW `staticMetadata`;--> statement-breakpoint
CREATE VIEW `staticMetadata` AS 
  SELECT baseQueryWithVA.*,
    json_object('tags', json_group_array(json_object('id', t_tag.id, 'name', t_tag.name))) AS tagObj
  FROM (
    SELECT baseQuery.*,
      json_object('vas', json_group_array(json_object('id', t_va.id, 'name', t_va.name))) AS vaObj
    FROM (
      SELECT t_work.id,
        t_work.title,
        t_work.circle_id,
        t_circle.name,
        json_object('id', t_work.circle_id, 'name', t_circle.name) AS circleObj,
        t_work.nsfw,
        t_work.release,
        t_work.dl_count,
        t_work.price,
        t_work.review_count,
        t_work.rate_count,
        t_work.rate_average_2dp,
        t_work.rate_count_detail,
        t_work.rank,
        t_work.insert_time
      FROM t_work
      JOIN t_circle ON t_circle.id = t_work.circle_id
    ) AS baseQuery
    JOIN r_va_work ON r_va_work.work_id = baseQuery.id
    JOIN t_va ON t_va.id = r_va_work.va_id
    GROUP BY baseQuery.id
  ) AS baseQueryWithVA
  LEFT JOIN r_tag_work ON r_tag_work.work_id = baseQueryWithVA.id
  LEFT JOIN t_tag ON t_tag.id = r_tag_work.tag_id
  GROUP BY baseQueryWithVA.id
;
