package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

type Store struct {
	client *redis.Client
	ctx    context.Context
}

func NewStore(redisURL string) (*Store, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis URL: %w", err)
	}

	client := redis.NewClient(opt)

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return &Store{
		client: client,
		ctx:    ctx,
	}, nil
}

func (s *Store) Close() error {
	return s.client.Close()
}

// Room operations

func (s *Store) SetRoom(code string, data interface{}, ttl time.Duration) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return s.client.Set(s.ctx, fmt.Sprintf("room:%s:state", code), jsonData, ttl).Err()
}

func (s *Store) GetRoom(code string, dest interface{}) error {
	data, err := s.client.Get(s.ctx, fmt.Sprintf("room:%s:state", code)).Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

func (s *Store) DeleteRoom(code string) error {
	pipe := s.client.Pipeline()
	pipe.Del(s.ctx, fmt.Sprintf("room:%s:state", code))
	pipe.Del(s.ctx, fmt.Sprintf("room:%s:game", code))
	pipe.SRem(s.ctx, "rooms:active", code)
	_, err := pipe.Exec(s.ctx)
	return err
}

func (s *Store) RoomExists(code string) (bool, error) {
	result, err := s.client.Exists(s.ctx, fmt.Sprintf("room:%s:state", code)).Result()
	return result > 0, err
}

// Game state operations

func (s *Store) SetGameState(code string, data interface{}, ttl time.Duration) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return s.client.Set(s.ctx, fmt.Sprintf("room:%s:game", code), jsonData, ttl).Err()
}

func (s *Store) GetGameState(code string, dest interface{}) error {
	data, err := s.client.Get(s.ctx, fmt.Sprintf("room:%s:game", code)).Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

// Active rooms set

func (s *Store) AddActiveRoom(code string) error {
	return s.client.SAdd(s.ctx, "rooms:active", code).Err()
}

func (s *Store) RemoveActiveRoom(code string) error {
	return s.client.SRem(s.ctx, "rooms:active", code).Err()
}

func (s *Store) IsRoomCodeTaken(code string) (bool, error) {
	return s.client.SIsMember(s.ctx, "rooms:active", code).Result()
}

func (s *Store) GetActiveRoomCount() (int64, error) {
	return s.client.SCard(s.ctx, "rooms:active").Result()
}

// Session operations (for reconnection)

type SessionData struct {
	PlayerID  string    `json:"playerId"`
	RoomCode  string    `json:"roomCode"`
	ExpiresAt time.Time `json:"expiresAt"`
}

func (s *Store) SetSession(sessionID string, data SessionData, ttl time.Duration) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return s.client.Set(s.ctx, fmt.Sprintf("session:%s", sessionID), jsonData, ttl).Err()
}

func (s *Store) GetSession(sessionID string) (*SessionData, error) {
	data, err := s.client.Get(s.ctx, fmt.Sprintf("session:%s", sessionID)).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	var session SessionData
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}
	return &session, nil
}

func (s *Store) DeleteSession(sessionID string) error {
	return s.client.Del(s.ctx, fmt.Sprintf("session:%s", sessionID)).Err()
}

func (s *Store) ExtendSession(sessionID string, ttl time.Duration) error {
	return s.client.Expire(s.ctx, fmt.Sprintf("session:%s", sessionID), ttl).Err()
}
