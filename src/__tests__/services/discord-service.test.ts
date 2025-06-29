import nock from 'nock';
import { HttpClient } from '../../services/http-client';
import { DiscordService } from '../../services/discord-service';
import { DiscordEmbed } from '../../types';

describe('DiscordService', () => {
  const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
  let httpClient: HttpClient;
  let discordService: DiscordService;

  beforeEach(() => {
    httpClient = new HttpClient();
    // モック用の performRequest を作成
    httpClient.performRequest = jest.fn().mockResolvedValue({ statusCode: 204, data: '', headers: {} });
    discordService = new DiscordService(httpClient, webhookUrl);
    nock.cleanAll();
  });

  // テストケース用のダミーEmbedを生成するヘルパー関数
  const createDummyEmbeds = (count: number): DiscordEmbed[] => {
    return Array.from({ length: count }, (_, i) => ({
      title: `Test Embed ${i + 1}`,
    }));
  };

  it('should send a message with a single embed', async () => {
    const embeds = createDummyEmbeds(1);
    await discordService.sendEmbeds(embeds);

    expect(httpClient.performRequest).toHaveBeenCalledTimes(1);
    expect(httpClient.performRequest).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ embeds }),
      })
    );
  });

  it('should split embeds into multiple requests if they exceed the limit of 10', async () => {
    const embeds = createDummyEmbeds(15);
    const firstChunk = embeds.slice(0, 10);
    const secondChunk = embeds.slice(10, 15);

    await discordService.sendEmbeds(embeds);

    expect(httpClient.performRequest).toHaveBeenCalledTimes(2);
    expect(httpClient.performRequest).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        body: JSON.stringify({ embeds: firstChunk }),
      })
    );
    expect(httpClient.performRequest).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        body: JSON.stringify({ embeds: secondChunk }),
      })
    );
  });

  it('should send a single request if the number of embeds is exactly 10', async () => {
    const embeds = createDummyEmbeds(10);
    await discordService.sendEmbeds(embeds);

    expect(httpClient.performRequest).toHaveBeenCalledTimes(1);
    expect(httpClient.performRequest).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        body: JSON.stringify({ embeds }),
      })
    );
  });

  it('should not send any request if the embeds array is empty', async () => {
    await discordService.sendEmbeds([]);
    expect(httpClient.performRequest).not.toHaveBeenCalled();
  });

  it('should throw an error if the http client fails to send a message', async () => {
    const embeds = createDummyEmbeds(1);
    (httpClient.performRequest as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(discordService.sendEmbeds(embeds)).rejects.toThrow('Network error');
  });

  it('should handle http client failure on chunked messages', async () => {
    const embeds = createDummyEmbeds(15);

    (httpClient.performRequest as jest.Mock)
      .mockResolvedValueOnce({ statusCode: 204, data: '', headers: {} }) // 1st success
      .mockRejectedValueOnce(new Error('Failed on second chunk')); // 2nd failure

    await expect(discordService.sendEmbeds(embeds)).rejects.toThrow('Failed on second chunk');
    expect(httpClient.performRequest).toHaveBeenCalledTimes(2);
  });
});
